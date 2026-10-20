import {
  Controller,
  Get,
  Post as HttpPost,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, AuthenticatedUser } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRole } from '@commercepilot/database';
import { PostsService, type PostListResponse } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { ApprovalDecisionDto } from './dto/approval-decision.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import type { Post as PostModel, PublishAttempt } from '@commercepilot/database';

@ApiTags('Posts & Publishing')
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
@Controller('workspaces/:workspaceId/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @HttpPost()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Create a new draft post' })
  async createPost(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreatePostDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<PostModel> {
    return this.postsService.createPost(workspaceId, dto, user.id, ip);
  }

  @Get()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List posts with filtering and pagination' })
  async getPosts(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryPostsDto,
  ): Promise<PostListResponse> {
    return this.postsService.getPosts(workspaceId, query);
  }

  @Get(':postId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get post details, approvals, and attempts' })
  async getPostById(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
  ): Promise<PostModel> {
    return this.postsService.getPostById(workspaceId, postId);
  }

  @Patch(':postId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Update draft post content and metadata' })
  async updatePost(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<PostModel> {
    return this.postsService.updatePost(workspaceId, postId, dto, user.id, ip);
  }

  @Delete(':postId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Delete a post (if not publishing or published)' })
  async deletePost(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.postsService.deletePost(workspaceId, postId, user.id, ip);
  }

  @HttpPost(':postId/request-approval')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Request approval for a draft post' })
  async requestApproval(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<PostModel> {
    return this.postsService.requestApproval(workspaceId, postId, user.id, ip);
  }

  @HttpPost(':postId/approve')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Approve a post (Admins and Owners only)' })
  async approvePost(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<PostModel> {
    return this.postsService.approvePost(workspaceId, postId, dto, user.id, ip);
  }

  @HttpPost(':postId/reject')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Reject a post back to draft (Admins and Owners only)' })
  async rejectPost(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<PostModel> {
    return this.postsService.rejectPost(workspaceId, postId, dto, user.id, ip);
  }

  @HttpPost(':postId/schedule')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Schedule a post for future publication' })
  async schedulePost(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @Body() dto: SchedulePostDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<PostModel> {
    return this.postsService.schedulePost(workspaceId, postId, dto, user.id, ip);
  }

  @HttpPost(':postId/publish-now')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Publish post immediately via provider adapter' })
  async publishNow(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<{ post: PostModel; attempt: PublishAttempt }> {
    return this.postsService.publishNow(workspaceId, postId, user.id, ip);
  }

  @HttpPost(':postId/cancel')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Cancel a scheduled or pending post' })
  async cancelPost(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<PostModel> {
    return this.postsService.cancelPost(workspaceId, postId, user.id, ip);
  }

  @Get(':postId/attempts')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get publishing attempt history for post' })
  async getAttempts(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
  ): Promise<PublishAttempt[]> {
    return this.postsService.getAttempts(workspaceId, postId);
  }
}
