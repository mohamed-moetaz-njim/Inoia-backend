import { NotFoundException } from '@nestjs/common';

/**
 * Ensures that the current user owns the resource.
 * Throws NotFoundException if not, to maintain privacy (404).
 * 
 * @param resourceOwnerId The ID of the user who owns the resource
 * @param currentUserId The ID of the user attempting access
 */
export function ensureOwnership(resourceOwnerId: string, currentUserId: string): void {
  if (resourceOwnerId !== currentUserId) {
    throw new NotFoundException('Resource not found');
  }
}

/**
 * Ensures that the current user is an Admin.
 * Used for service-level checks where guards might not be enough or for double-safety.
 * 
 * @param userRole The role of the current user
 */
export function ensureAdmin(userRole: string): void {
    if (userRole !== 'ADMIN') {
        throw new NotFoundException('Resource not found'); // Hide admin resources from non-admins
    }
}
