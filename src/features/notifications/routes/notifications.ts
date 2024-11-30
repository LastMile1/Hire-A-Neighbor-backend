import { Router } from 'express';
import { prisma } from '../../../integrations/prisma';
import { AppError } from '../../../core/middleware/errorHandler';
import { authenticate } from '../../../core/middleware/auth';

const router = Router();

// Get all notifications for the authenticated user
router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const notifications = await prisma.notifications.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const notification = await prisma.notifications.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!notification) {
      throw new AppError(404, 'Notification not found');
    }

    const updatedNotification = await prisma.notifications.update({
      where: {
        id: req.params.id
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    res.json(updatedNotification);
  } catch (error) {
    next(error);
  }
});

export default router;
