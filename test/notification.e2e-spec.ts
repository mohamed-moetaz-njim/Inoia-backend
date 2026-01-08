import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Notification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const cleanDb = async () => {
    await prisma.aiMessage.deleteMany();
    await prisma.aiConversation.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.vote.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
  };

  beforeEach(async () => {
    await cleanDb();
  });

  const createAuthenticatedUser = async (username: string, email: string) => {
    const passwordHash = await argon2.hash('password');
    const user = await prisma.user.create({
      data: { username, email, passwordHash, role: Role.STUDENT },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password: 'password' });

    return { user, token: loginRes.body.accessToken };
  };

  describe('Notifications Flow', () => {
    it('should notify post author when someone comments', async () => {
      const { user: author, token: authorToken } =
        await createAuthenticatedUser('Author', 'author@test.com');
      const { user: commenter, token: commenterToken } =
        await createAuthenticatedUser('Commenter', 'commenter@test.com');

      const post = await prisma.post.create({
        data: { authorId: author.id, title: 'My Post', content: 'Content' },
      });

      // Commenter comments on post
      await request(app.getHttpServer())
        .post(`/forum/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ content: 'Nice post!' })
        .expect(201);

      // Check Author's notifications
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].content).toContain(
        '@Commenter commented on your post',
      );

      // Commenter should have no notifications
      const res2 = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${commenterToken}`)
        .expect(200);
      expect(res2.body.data).toHaveLength(0);
    });

    it('should notify mentioned user', async () => {
      const { user: author, token: authorToken } =
        await createAuthenticatedUser('Author', 'author@test.com');
      const { user: commenter, token: commenterToken } =
        await createAuthenticatedUser('Commenter', 'commenter@test.com');
      const { user: mentioned, token: mentionedToken } =
        await createAuthenticatedUser('Mentioned', 'mentioned@test.com');

      const post = await prisma.post.create({
        data: { authorId: author.id, title: 'My Post', content: 'Content' },
      });

      // Commenter mentions 'Mentioned'
      await request(app.getHttpServer())
        .post(`/forum/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ content: 'Hey @Mentioned check this out' })
        .expect(201);

      // Check Mentioned user's notifications
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${mentionedToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].content).toContain('@Commenter mentioned you');

      // Check Author's notifications (should also get one for comment on post)
      const resAuthor = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      expect(resAuthor.body.data).toHaveLength(1);
    });

    it('should not notify self', async () => {
      const { user: author, token: authorToken } =
        await createAuthenticatedUser('Author', 'author@test.com');

      const post = await prisma.post.create({
        data: { authorId: author.id, title: 'My Post', content: 'Content' },
      });

      // Author comments on own post mentioning self
      await request(app.getHttpServer())
        .post(`/forum/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ content: 'I am commenting @Author' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });

    it('should mark notifications as read', async () => {
      const { user: author, token: authorToken } =
        await createAuthenticatedUser('Author', 'author@test.com');
      const { user: commenter, token: commenterToken } =
        await createAuthenticatedUser('Commenter', 'commenter@test.com');

      const post = await prisma.post.create({
        data: { authorId: author.id, title: 'My Post', content: 'Content' },
      });

      await request(app.getHttpServer())
        .post(`/forum/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ content: 'Comment 1' })
        .expect(201);

      // Get notification id
      const listRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authorToken}`);

      const notifId = listRes.body.data[0].id;
      expect(listRes.body.data[0].readAt).toBeNull();

      // Mark read
      await request(app.getHttpServer())
        .patch(`/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      // Verify read
      const listRes2 = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authorToken}`);
      expect(listRes2.body.data[0].readAt).not.toBeNull();

      // Filter unread
      const unreadRes = await request(app.getHttpServer())
        .get('/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${authorToken}`);
      expect(unreadRes.body.data).toHaveLength(0);
    });

    it('should return correct unread count', async () => {
      const { user: author, token: authorToken } =
        await createAuthenticatedUser('Author', 'author@test.com');
      const { user: commenter, token: commenterToken } =
        await createAuthenticatedUser('Commenter', 'commenter@test.com');

      const post = await prisma.post.create({
        data: { authorId: author.id, title: 'My Post', content: 'Content' },
      });

      // 1. Initial count should be 0
      const res1 = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      expect(res1.body).toEqual({ unreadCount: 0 });

      // 2. Create notification
      await request(app.getHttpServer())
        .post(`/forum/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${commenterToken}`)
        .send({ content: 'Comment 1' })
        .expect(201);

      // 3. Check count is 1
      const res2 = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      expect(res2.body).toEqual({ unreadCount: 1 });

      // 4. Mark as read
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      // 5. Check count is 0
      const res3 = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      expect(res3.body).toEqual({ unreadCount: 0 });
    });

    it('should return 401 for unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(401);
    });
  });
});
