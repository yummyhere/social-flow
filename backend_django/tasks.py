from celery import shared_task
from django.utils import timezone
from django.db import transaction
import logging
from .models import SocialPost, PostTarget, PublishingAttempt
from .meta_service import DjangoMetaService

logger = logging.getLogger(__name__)

@shared_task
def dispatch_due_posts():
    """
    Periodic Celery Beat dispatcher: runs every 10 seconds.
    Queries due posts from PostgreSQL and dispatches individual Celery worker tasks.
    """
    now = timezone.now()
    due_posts = SocialPost.objects.filter(
        status='scheduled',
        scheduled_at_utc__lte=now,
        locked_at__isnull=True,
    )[:20]

    for post in due_posts:
        with transaction.atomic():
            post.status = 'publishing'
            post.locked_at = now
            post.locked_by = 'celery-dispatcher'
            post.save(update_fields=['status', 'locked_at', 'locked_by'])

        # Spawn asynchronous worker task
        publish_social_post_task.delay(str(post.id))

@shared_task(bind=True, max_retries=3)
def publish_social_post_task(self, post_id: str):
    """
    Celery worker task to publish targets for a given post.
    Reconciles targets, calls Meta Graph API, and records attempts.
    """
    try:
        post = SocialPost.objects.get(id=post_id)
    except SocialPost.DoesNotExist:
        return

    meta_service = DjangoMetaService()
    targets = post.targets.exclude(target_status='published')

    for target in targets:
        attempt_number = target.attempt_count + 1
        started_at = timezone.now()
        target.target_status = 'publishing'
        target.attempt_count = attempt_number
        target.save()

        # Decrypt token & call Meta Graph API
        result = meta_service.publish_target(post, target)
        completed_at = timezone.now()

        # Audit attempt
        PublishingAttempt.objects.create(
            target=target,
            post=post,
            attempt_number=attempt_number,
            started_at=started_at,
            completed_at=completed_at,
            result='success' if result.success else 'failed',
            error_code=result.error_code,
            error_message=result.error_message,
            api_request_summary=result.request_summary,
            api_response_summary=result.response_summary,
        )

        if result.success:
            target.target_status = 'published'
            target.external_post_id = result.external_post_id
            target.external_post_url = result.external_post_url
            target.published_at = completed_at
            target.save()
        else:
            target.target_status = 'failed'
            target.last_error_code = result.error_code
            target.last_error_message = result.error_message
            target.save()

    # Reconcile post overall status
    all_targets = post.targets.all()
    all_pub = all_targets.filter(target_status='published').count() == all_targets.count()
    any_pub = all_targets.filter(target_status='published').exists()
    all_fail = all_targets.filter(target_status='failed').count() == all_targets.count()

    if all_pub:
        post.status = 'published'
        post.published_at = timezone.now()
    elif any_pub:
        post.status = 'partially_published'
        post.published_at = timezone.now()
    elif all_fail:
        post.status = 'failed'

    post.locked_at = None
    post.locked_by = None
    post.save()
