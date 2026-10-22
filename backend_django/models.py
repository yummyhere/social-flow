import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from cryptography.fernet import Fernet
from django.conf import settings

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timezone = models.CharField(max_length=64, default='UTC')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class SocialAccount(models.Model):
    PLATFORM_CHOICES = (
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
    )
    ACCOUNT_TYPE_CHOICES = (
        ('facebook_page', 'Facebook Page'),
        ('instagram_business', 'Instagram Business'),
        ('instagram_creator', 'Instagram Creator'),
    )
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
        ('error', 'Error'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    platform = models.CharField(max_length=32, choices=PLATFORM_CHOICES)
    platform_account_id = models.CharField(max_length=128)
    display_name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=64, choices=ACCOUNT_TYPE_CHOICES)
    encrypted_access_token = models.TextField()
    token_expires_at = models.DateTimeField(null=True, blank=True)
    permissions = models.JSONField(default=list)
    connection_status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='active')
    last_connection_check = models.DateTimeField(null=True, blank=True)
    avatar_url = models.URLField(max_length=512, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'platform', 'platform_account_id')
        indexes = [
            models.Index(fields=['user', 'platform']),
        ]

class SocialPost(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('publishing', 'Publishing'),
        ('published', 'Published'),
        ('partially_published', 'Partially Published'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    caption = models.TextField(blank=True, default='')
    media_urls = models.JSONField(default=list)
    timezone = models.CharField(max_length=64, default='UTC')
    scheduled_at_utc = models.DateTimeField(null=True, blank=True, db_index=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='draft', db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.CharField(max_length=128, null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', 'scheduled_at_utc']),
        ]

class PostTarget(models.Model):
    TARGET_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('publishing', 'Publishing'),
        ('published', 'Published'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(SocialPost, on_delete=models.CASCADE, related_name='targets')
    social_account = models.ForeignKey(SocialAccount, on_delete=models.CASCADE, related_name='post_targets')
    platform = models.CharField(max_length=32)
    target_status = models.CharField(max_length=32, choices=TARGET_STATUS_CHOICES, default='pending')
    external_post_id = models.CharField(max_length=255, null=True, blank=True)
    external_post_url = models.URLField(max_length=512, null=True, blank=True)
    attempt_count = models.IntegerField(default=0)
    last_error_code = models.CharField(max_length=64, null=True, blank=True)
    last_error_message = models.TextField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class PublishingAttempt(models.Model):
    RESULT_CHOICES = (
        ('success', 'Success'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target = models.ForeignKey(PostTarget, on_delete=models.CASCADE, related_name='attempts')
    post = models.ForeignKey(SocialPost, on_delete=models.CASCADE, related_name='attempts')
    attempt_number = models.IntegerField(default=1)
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField()
    result = models.CharField(max_length=16, choices=RESULT_CHOICES)
    error_code = models.CharField(max_length=64, null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    api_request_summary = models.TextField(blank=True, default='')
    api_response_summary = models.TextField(blank=True, default='')
