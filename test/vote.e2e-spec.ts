import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

describe('Voting System (e2e)', () => {
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
    await prisma.vote.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
  };

  beforeEach(async () => {
    await cleanDb();
  });

  describe('Vote Logic', () => {
    let token: string;
    let userId: string;
    let postId: string;
    let otherToken: string;

    beforeEach(async () => {
        // Create user 1 (Voter)
        const hash = await argon2.hash('pass');
        const user = await prisma.user.create({
            data: { email: 'voter@test.com', username: 'voter', role: Role.STUDENT, passwordHash: hash }
        });
        userId = user.id;
        const login = await request(app.getHttpServer()).post('/auth/signin').send({ email: 'voter@test.com', password: 'pass' });
        token = login.body.accessToken;

        // Create user 2 (Author)
        const author = await prisma.user.create({
            data: { email: 'author@test.com', username: 'author', role: Role.STUDENT, passwordHash: hash }
        });
        const authorLogin = await request(app.getHttpServer()).post('/auth/signin').send({ email: 'author@test.com', password: 'pass' });
        otherToken = authorLogin.body.accessToken;

        // Create Post by Author
        const post = await prisma.post.create({
            data: { authorId: author.id, title: 'Post', content: 'Content' }
        });
        postId = post.id;
    });

    it('should allow voting on a post', async () => {
        const res = await request(app.getHttpServer())
            .post('/votes')
            .set('Authorization', `Bearer ${token}`)
            .send({ postId, value: 1 })
            .expect(201);
        
        expect(res.body.status).toBe('voted');
        expect(res.body.value).toBe(1);

        // Check counts
        const postRes = await request(app.getHttpServer())
            .get(`/forum/posts/${postId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(postRes.body.voteCount).toBe(1);
        expect(postRes.body.userVote).toBe(1);
    });

    it('should toggle vote off if same value', async () => {
        // Vote first
        await request(app.getHttpServer())
            .post('/votes')
            .set('Authorization', `Bearer ${token}`)
            .send({ postId, value: 1 })
            .expect(201);

        // Vote again
        const res = await request(app.getHttpServer())
            .post('/votes')
            .set('Authorization', `Bearer ${token}`)
            .send({ postId, value: 1 })
            .expect(201); 
        
        expect(res.body.status).toBe('unvoted');

        // Check counts
        const postRes = await request(app.getHttpServer())
            .get(`/forum/posts/${postId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(postRes.body.voteCount).toBe(0);
        expect(postRes.body.userVote).toBe(0);
    });

    it('should update vote if different value', async () => {
        // Vote UP
        await request(app.getHttpServer())
            .post('/votes')
            .set('Authorization', `Bearer ${token}`)
            .send({ postId, value: 1 })
            .expect(201);

        // Vote DOWN
        const res = await request(app.getHttpServer())
            .post('/votes')
            .set('Authorization', `Bearer ${token}`)
            .send({ postId, value: -1 })
            .expect(201);
        
        expect(res.body.status).toBe('updated');
        expect(res.body.value).toBe(-1);

        // Check counts
        const postRes = await request(app.getHttpServer())
            .get(`/forum/posts/${postId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(postRes.body.voteCount).toBe(-1);
        expect(postRes.body.userVote).toBe(-1);
    });

    it('should prevent self-voting', async () => {
        await request(app.getHttpServer())
            .post('/votes')
            .set('Authorization', `Bearer ${otherToken}`) // Author tries to vote
            .send({ postId, value: 1 })
            .expect(403);
    });

    it('should return correct vote status for list of posts', async () => {
        // Vote UP
        await request(app.getHttpServer())
            .post('/votes')
            .set('Authorization', `Bearer ${token}`)
            .send({ postId, value: 1 });

        const res = await request(app.getHttpServer())
            .get('/forum/posts')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(res.body.data[0].voteCount).toBe(1);
        expect(res.body.data[0].userVote).toBe(1);

        // Check for guest (no token)
        const guestRes = await request(app.getHttpServer())
            .get('/forum/posts')
            .expect(200);
        
        expect(guestRes.body.data[0].voteCount).toBe(1);
        expect(guestRes.body.data[0].userVote).toBe(0);
    });
  });
});
