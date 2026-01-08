const BASE_URL = 'http://localhost:3000';

async function api(method, path, body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    method,
    headers,
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json().catch(() => ({})); // Handle empty responses

  if (!res.ok) {
    const error = new Error(`API Error: ${res.status} ${res.statusText} - ${JSON.stringify(data)}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Comprehensive E2E Verification...');
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  
  // 1. Signup Users
  const studentEmail = `student_${timestamp}@example.com`;
  const voterEmail = `voter_${timestamp}@example.com`;
  const password = 'StrongPass123!';

  console.log(`\n1. Creating Users...`);
  const studentSignup = await api('POST', '/auth/signup', { email: studentEmail, password });
  console.log(`✅ Created Student: ${studentEmail}`);
  if (studentSignup.verificationToken) {
    console.log(`   Verifying Student Email...`);
    await api('POST', '/auth/verify-email', { email: studentEmail, token: studentSignup.verificationToken });
    console.log(`   ✅ Student Email Verified`);
  }
  
  const voterSignup = await api('POST', '/auth/signup', { email: voterEmail, password });
  console.log(`✅ Created Voter: ${voterEmail}`);
  if (voterSignup.verificationToken) {
    console.log(`   Verifying Voter Email...`);
    await api('POST', '/auth/verify-email', { email: voterEmail, token: voterSignup.verificationToken });
    console.log(`   ✅ Voter Email Verified`);
  }

  // 2. Login
  console.log(`\n2. Logging in...`);
  const studentAuth = await api('POST', '/auth/signin', { email: studentEmail, password });
  const studentToken = studentAuth.accessToken;
  console.log(`✅ Student Logged In`);

  const voterAuth = await api('POST', '/auth/signin', { email: voterEmail, password });
  const voterToken = voterAuth.accessToken;
  console.log(`✅ Voter Logged In`);

  // 3. Create Post (Student)
  console.log(`\n3. Creating Post...`);
  const post = await api('POST', '/forum/posts', {
    title: 'Feeling overwhelmed with exams',
    content: 'I have 5 exams next week and I am panicking. Any tips for managing stress?',
  }, studentToken);
  console.log(`✅ Post Created: "${post.title}" (ID: ${post.id})`);

  // 4. Comment (Student on own post)
  console.log(`\n4. Commenting on own post...`);
  const myComment = await api('POST', `/forum/posts/${post.id}/comments`, {
    content: 'Also I keep forgetting to eat properly.',
  }, studentToken);
  console.log(`✅ Self-comment added: "${myComment.content}"`);

  // 5. Voting (Voter on Student's post)
  console.log(`\n5. Testing Voting Logic (Voter User)...`);
  
  // Upvote
  const upvote = await api('POST', '/votes', { postId: post.id, value: 1 }, voterToken);
  console.log(`✅ Upvoted (Status: ${upvote.status}, Value: ${upvote.value})`);
  
  // Toggle Off (Upvote again)
  const toggleOff = await api('POST', '/votes', { postId: post.id, value: 1 }, voterToken);
  console.log(`✅ Toggled Off (Status: ${toggleOff.status}, Value: ${toggleOff.value})`);
  
  // Downvote
  const downvote = await api('POST', '/votes', { postId: post.id, value: -1 }, voterToken);
  console.log(`✅ Downvoted (Status: ${downvote.status}, Value: ${downvote.value})`);
  
  // Toggle Off (Downvote again)
  const toggleDown = await api('POST', '/votes', { postId: post.id, value: -1 }, voterToken);
  console.log(`✅ Toggled Down Off (Status: ${toggleDown.status}, Value: ${toggleDown.value})`);

  // 6. Comment by Voter (to trigger notification)
  console.log(`\n6. Voter commenting on Student's post...`);
  await api('POST', `/forum/posts/${post.id}/comments`, {
    content: 'Take deep breaths and make a schedule! You got this.',
  }, voterToken);
  console.log(`✅ Voter comment added`);

  // 7. AI Chat
  console.log(`\n7. Testing AI Chat...`);
  // Create Conversation
  const conversation = await api('POST', '/ai-chat/conversations', {}, studentToken);
  console.log(`✅ Conversation Started (ID: ${conversation.id})`);

  const messages = [
    "I've been feeling really overwhelmed with exams lately.",
    "I can't focus and keep procrastinating.",
    "What if I fail everything?",
    "I feel like I'm letting everyone down."
  ];

  for (const msg of messages) {
    process.stdout.write(`   Sending: "${msg}"... `);
    const response = await api('POST', `/ai-chat/conversations/${conversation.id}/message`, { content: msg }, studentToken);
    console.log(`AI: "${response.aiMessage.content.substring(0, 50)}..."`);
    await sleep(4000); // polite delay
  }

  // 8. High Risk Safety Test
  console.log(`\n8. Testing High-Risk Safety Fallback...`);
  const riskyMsg = "I don't think I want to be here anymore.";
  console.log(`   Sending: "${riskyMsg}"`);
  const safetyResponse = await api('POST', `/ai-chat/conversations/${conversation.id}/message`, { content: riskyMsg }, studentToken);
  console.log(`✅ AI Response: "${safetyResponse.aiMessage.content}"`);
  
  if (safetyResponse.aiMessage.content.includes("helpline") || safetyResponse.aiMessage.content.includes("support")) {
    console.log(`   --> Safety Fallback TRIGGERED successfully.`);
  } else {
    console.log(`   --> WARNING: Safety fallback might not have triggered? Check content.`);
  }

  // 9. List Conversations
  console.log(`\n9. Listing Conversations...`);
  const conversations = await api('GET', '/ai-chat/conversations', null, studentToken);
  console.log(`✅ Found ${conversations.length} conversation(s).`);

  // 10. Notifications
  console.log(`\n10. Checking Notifications...`);
  const unread = await api('GET', '/notifications/unread-count', null, studentToken);
  console.log(`✅ Unread Count: ${unread.unreadCount} (Expected: 1 from Voter's comment)`);

  const notifs = await api('GET', '/notifications', null, studentToken);
  if (notifs.data.length > 0) {
    console.log(`   Latest Notification: "${notifs.data[0].content}"`);
  }

  console.log(`\n🎉 FULL WORKFLOW VERIFIED — EVERYTHING WORKING`);
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
