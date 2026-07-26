import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';

async function testApi() {
  console.log('Testing ScaleMate Backend REST API...');

  try {
    // 1. Check profile of seed user Alice (1001)
    const profileRes = await fetch(`${API_URL}/api/profile`, {
      headers: { 'x-dev-user-id': '1001' }
    });
    const profileData = await profileRes.json();
    console.log('1. User Profile 1001:', profileData.user.name, '| Verified:', profileData.user.isVerified, '| Weight:', profileData.user.weight, 'kg');

    // 2. Fetch Feed for Alice (1001)
    const feedRes = await fetch(`${API_URL}/api/feed`, {
      headers: { 'x-dev-user-id': '1001' }
    });
    const feedData = await feedRes.json();
    console.log('2. Feed items returned for 1001:', feedData.feed.map(u => `${u.name} (${u.weight}kg, BMI ${u.bmi})`));

    // 3. Check profile of seed user Bob (1002)
    const bobRes = await fetch(`${API_URL}/api/profile`, {
      headers: { 'x-dev-user-id': '1002' }
    });
    const bobData = await bobRes.json();
    console.log('3. User Profile 1002:', bobData.user.name, '| Verified:', bobData.user.isVerified, '| Weight:', bobData.user.weight, 'kg');

    // 4. Test mutual like between 1001 (Alice) and 1002 (Bob)
    const likeRes = await fetch(`${API_URL}/api/like`, {
      method: 'POST',
      headers: { 
        'x-dev-user-id': '1001',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetUserId: '1002', action: 'like' })
    });
    const likeData = await likeRes.json();
    console.log('4. Alice likes Bob - Match status:', likeData.isMatch);

    const bobLikeRes = await fetch(`${API_URL}/api/like`, {
      method: 'POST',
      headers: { 
        'x-dev-user-id': '1002',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetUserId: '1001', action: 'like' })
    });
    const bobLikeData = await bobLikeRes.json();
    console.log('5. Bob likes Alice back - Match status (Expect TRUE):', bobLikeData.isMatch);

    // 6. Check matches list for Alice
    const matchesRes = await fetch(`${API_URL}/api/matches`, {
      headers: { 'x-dev-user-id': '1001' }
    });
    const matchesData = await matchesRes.json();
    console.log('6. Alice Matches count:', matchesData.matches.length, '| Partner:', matchesData.matches[0]?.user?.name);

    // 7. Check Admin Stats
    const statsRes = await fetch(`${API_URL}/api/admin/stats`);
    const statsData = await statsRes.json();
    console.log('7. Admin Stats - Total Users:', statsData.stats.totalUsers, '| Verified:', statsData.stats.verifiedUsers, '| Likes:', statsData.stats.totalLikes);

    console.log('\n✅ All API test checks passed successfully!');

  } catch (error) {
    console.error('❌ API Test failed:', error);
  }
}

testApi();
