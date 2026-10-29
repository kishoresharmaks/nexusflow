import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import TeamPage from '../src/app/settings/team/page';
import ActivateAccountPage from '../src/app/activate-account/page';
import VerifyEmailPage from '../src/app/verify-email/page';
import { DashboardOverview } from '../src/components/dashboard-overview';
import { AuthProvider } from '../src/context/auth-context';
import { api, type WorkspaceMember, type WorkspaceInvitation } from '../src/lib/api';

vi.mock('next/navigation', () => {
  let searchParams = new URLSearchParams();
  return {
    usePathname: () => '/settings/team',
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => searchParams,
    __setSearchParams: (params: Record<string, string>) => {
      searchParams = new URLSearchParams(params);
    },
  };
});

describe('Team & Access, Direct Creation, Activation, and Verification UI', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockOwnerUser = {
    id: 'user_owner',
    name: 'Alice Owner',
    email: 'alice@acme.test',
    isEmailVerified: true,
  };

  const mockWorkspace = {
    id: 'ws_test_123',
    name: 'Acme Flagship',
    slug: 'acme-flagship',
    role: 'OWNER',
  };

  const mockMembers: WorkspaceMember[] = [
    {
      membershipId: 'mem_1',
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'user_owner',
        name: 'Alice Owner',
        email: 'alice@acme.test',
        isEmailVerified: true,
        accountStatus: 'ACTIVE',
      },
    },
    {
      membershipId: 'mem_2',
      role: 'MEMBER',
      status: 'ACTIVE',
      joinedAt: '2026-02-01T00:00:00Z',
      user: {
        id: 'user_bob',
        name: 'Bob Colleague',
        email: 'bob@acme.test',
        isEmailVerified: false,
        accountStatus: 'PENDING_ACTIVATION',
      },
    },
    {
      membershipId: 'mem_3',
      role: 'VIEWER',
      status: 'SUSPENDED',
      joinedAt: '2026-03-01T00:00:00Z',
      user: {
        id: 'user_carol',
        name: 'Carol Suspended',
        email: 'carol@acme.test',
        isEmailVerified: true,
        accountStatus: 'ACTIVE',
      },
    },
  ];

  const mockInvitations: WorkspaceInvitation[] = [
    {
      id: 'inv_1',
      emailNormalized: 'invitee@external.test',
      role: 'ADMIN',
      status: 'PENDING',
      expiresAt: '2026-10-30T00:00:00Z',
      acceptedAt: null,
      revokedAt: null,
      createdAt: '2026-10-22T00:00:00Z',
    },
  ];

  describe('Team & Access Page', () => {
    it('renders segmented control with Option A and Option B member creation modes', async () => {
      vi.spyOn(api, 'getWorkspaceMembers').mockResolvedValue(mockMembers);
      vi.spyOn(api, 'getWorkspaceInvitations').mockResolvedValue(mockInvitations);

      render(
        <AuthProvider initialToken="tok_1" initialUser={mockOwnerUser} initialWorkspace={mockWorkspace}>
          <TeamPage />
        </AuthProvider>,
      );

      const options = await screen.findAllByText('Option A: Invite by Email');
      expect(options.length).toBeGreaterThan(0);
      expect(screen.getByText('Option B: Create Member')).toBeDefined();
    });

    it('submits Option A: Invite by Email with email and role', async () => {
      vi.spyOn(api, 'getWorkspaceMembers').mockResolvedValue(mockMembers);
      vi.spyOn(api, 'getWorkspaceInvitations').mockResolvedValue(mockInvitations);
      const inviteSpy = vi.spyOn(api, 'inviteWorkspaceMember').mockResolvedValue({
        id: 'inv_new',
        emailNormalized: 'guest@company.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: '2026-10-29T00:00:00Z',
        acceptedAt: null,
        revokedAt: null,
        createdAt: '2026-10-22T00:00:00Z',
      });

      render(
        <AuthProvider initialToken="tok_1" initialUser={mockOwnerUser} initialWorkspace={mockWorkspace}>
          <TeamPage />
        </AuthProvider>,
      );

      const emailInput = await screen.findByPlaceholderText('name@company.com');
      fireEvent.change(emailInput, { target: { value: 'guest@company.com' } });

      const sendBtn = screen.getByRole('button', { name: /send invite/i });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(inviteSpy).toHaveBeenCalledWith('ws_test_123', 'guest@company.com', 'MEMBER');
      });
    });

    it('switches to Option B and provisions a member directly with name, email, and role', async () => {
      vi.spyOn(api, 'getWorkspaceMembers').mockResolvedValue(mockMembers);
      vi.spyOn(api, 'getWorkspaceInvitations').mockResolvedValue(mockInvitations);
      const createSpy = vi.spyOn(api, 'createMemberDirectly').mockResolvedValue({
        membershipId: 'mem_new_direct',
        role: 'ADMIN',
        status: 'PENDING_ACCEPTANCE',
        joinedAt: '2026-10-22T00:00:00Z',
        user: {
          id: 'user_david',
          name: 'David New',
          email: 'david@company.com',
          isEmailVerified: false,
          accountStatus: 'PENDING_ACTIVATION',
        },
      });

      render(
        <AuthProvider initialToken="tok_1" initialUser={mockOwnerUser} initialWorkspace={mockWorkspace}>
          <TeamPage />
        </AuthProvider>,
      );

      // Switch to Option B
      const optionBBtn = await screen.findByText('Option B: Create Member');
      fireEvent.click(optionBBtn);

      const nameInput = await screen.findByPlaceholderText('Jane Doe');
      const emailInput = screen.getByPlaceholderText('jane@company.com');
      const deptInput = screen.getByPlaceholderText('Marketing, Growth...');

      fireEvent.change(nameInput, { target: { value: 'David New' } });
      fireEvent.change(emailInput, { target: { value: 'david@company.com' } });
      fireEvent.change(deptInput, { target: { value: 'Growth' } });

      const createBtn = screen.getByRole('button', { name: /Create Member & Send Activation Email/i });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          'ws_test_123',
          'David New',
          'david@company.com',
          'MEMBER',
          'Growth',
        );
      });
    });

    it('displays independent status badges for Membership, Account, and Email verification', async () => {
      vi.spyOn(api, 'getWorkspaceMembers').mockResolvedValue(mockMembers);
      vi.spyOn(api, 'getWorkspaceInvitations').mockResolvedValue(mockInvitations);

      render(
        <AuthProvider initialToken="tok_1" initialUser={mockOwnerUser} initialWorkspace={mockWorkspace}>
          <TeamPage />
        </AuthProvider>,
      );

      // Verify user names
      expect(await screen.findByText('Alice Owner')).toBeDefined();
      expect(screen.getByText('Bob Colleague')).toBeDefined();
      expect(screen.getByText('Carol Suspended')).toBeDefined();

      // Independent badges
      expect(screen.getByText('Account pending activation')).toBeDefined();
      expect(screen.getByText('Membership suspended')).toBeDefined();
      expect(screen.getByText('Email unverified')).toBeDefined();
      expect(screen.getAllByText('Email verified').length).toBeGreaterThan(0);
    });

    it('suspends and reactivates a member workspace access via api.updateWorkspaceMemberStatus', async () => {
      vi.spyOn(api, 'getWorkspaceMembers').mockResolvedValue(mockMembers);
      vi.spyOn(api, 'getWorkspaceInvitations').mockResolvedValue(mockInvitations);
      const statusSpy = vi.spyOn(api, 'updateWorkspaceMemberStatus').mockResolvedValue({
        membershipId: 'mem_2',
        role: 'MEMBER',
        status: 'SUSPENDED',
        joinedAt: '2026-02-01T00:00:00Z',
        user: {
          id: 'user_bob',
          name: 'Bob Colleague',
          email: 'bob@acme.test',
          isEmailVerified: false,
          accountStatus: 'ACTIVE',
        },
      });

      render(
        <AuthProvider initialToken="tok_1" initialUser={mockOwnerUser} initialWorkspace={mockWorkspace}>
          <TeamPage />
        </AuthProvider>,
      );

      const suspendBtn = await screen.findByRole('button', { name: /suspend access/i });
      fireEvent.click(suspendBtn);

      await waitFor(() => {
        expect(statusSpy).toHaveBeenCalledWith('ws_test_123', 'mem_2', 'SUSPENDED');
      });
    });
  });

  describe('Activate Account Page', () => {
    it('activates account with valid token and sets new password', async () => {
      const nav = await import('next/navigation');
      (nav as any).__setSearchParams({ token: 'test_activation_token_123' });

      const activateSpy = vi.spyOn(api, 'activateAccount').mockResolvedValue({
        message: 'Account activated successfully. You can now sign in.',
      });

      render(<ActivateAccountPage />);

      const passwordInputs = screen.getAllByPlaceholderText('••••••••••••');
      const passwordInput = passwordInputs[0]!;
      const confirmInput = passwordInputs[1]!;

      fireEvent.change(passwordInput, { target: { value: 'SecretPassword99!' } });
      fireEvent.change(confirmInput, { target: { value: 'SecretPassword99!' } });

      const submitBtn = screen.getByRole('button', { name: /activate account & continue/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(activateSpy).toHaveBeenCalledWith('test_activation_token_123', 'SecretPassword99!');
        expect(screen.getByText('Account Activated Successfully!')).toBeDefined();
      });
    });
  });

  describe('Verify Email Page', () => {
    it('auto-verifies email when valid token is present in search params', async () => {
      const nav = await import('next/navigation');
      (nav as any).__setSearchParams({ token: 'verify_tok_999' });

      const verifySpy = vi.spyOn(api, 'verifyEmail').mockResolvedValue({
        message: 'Email verified successfully.',
      });

      render(
        <AuthProvider initialToken="tok_1" initialUser={mockOwnerUser} initialWorkspace={mockWorkspace}>
          <VerifyEmailPage />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(verifySpy).toHaveBeenCalledWith('verify_tok_999');
        expect(screen.getByText('Email Address Verified!')).toBeDefined();
      });
    });
  });

  describe('Dashboard Email Verification Indicator', () => {
    it('shows unverified email warning banner with resend action when user email is not verified', async () => {
      const unverifiedUser = {
        ...mockOwnerUser,
        isEmailVerified: false,
      };

      vi.spyOn(api, 'getAnalyticsOverview').mockResolvedValue({
        totalRevenueCents: 50000,
        totalConversions: 10,
        totalClicks: 200,
        currency: 'USD',
      } as any);
      vi.spyOn(api, 'getPosts').mockResolvedValue({ items: [], total: 0 } as any);
      vi.spyOn(api, 'getProducts').mockResolvedValue({ items: [], total: 0 } as any);
      vi.spyOn(api, 'getStoreConnections').mockResolvedValue([]);
      vi.spyOn(api, 'getSocialAccounts').mockResolvedValue([]);

      const resendSpy = vi.spyOn(api, 'resendVerification').mockResolvedValue({
        message: 'A verification link has been sent to your email address.',
      });

      render(
        <AuthProvider initialToken="tok_1" initialUser={unverifiedUser} initialWorkspace={mockWorkspace}>
          <DashboardOverview />
        </AuthProvider>,
      );

      expect(await screen.findByText('Email not verified')).toBeDefined();
      expect(screen.getByText(/Pending Verification/i)).toBeDefined();

      const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(resendSpy).toHaveBeenCalled();
      });
    });

    it('shows email verified badge when user email is verified', async () => {
      vi.spyOn(api, 'getAnalyticsOverview').mockResolvedValue({
        totalRevenueCents: 50000,
        totalConversions: 10,
        totalClicks: 200,
        currency: 'USD',
      } as any);
      vi.spyOn(api, 'getPosts').mockResolvedValue({ items: [], total: 0 } as any);
      vi.spyOn(api, 'getProducts').mockResolvedValue({ items: [], total: 0 } as any);
      vi.spyOn(api, 'getStoreConnections').mockResolvedValue([]);
      vi.spyOn(api, 'getSocialAccounts').mockResolvedValue([]);

      render(
        <AuthProvider initialToken="tok_1" initialUser={mockOwnerUser} initialWorkspace={mockWorkspace}>
          <DashboardOverview />
        </AuthProvider>,
      );

      expect(await screen.findByText('Email verified')).toBeDefined();
      expect(screen.queryByText('Email not verified')).toBeNull();
    });
  });
});
