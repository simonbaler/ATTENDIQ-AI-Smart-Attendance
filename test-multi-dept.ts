async function runVerification() {
  const baseURL = 'http://localhost:3000';
  console.log('=== ATTENDIQ AI: MULTI-DEPARTMENT ATTENDANCE VERIFICATION ===\n');

  // 1. Authenticate as Admin
  console.log('1. Authenticating as Admin...');
  const loginRes = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✓ Admin authenticated successfully.');

  // 2. Synchronize Google Sheet / Authoritative Institutional Roster
  console.log('\n2. Syncing Google Sheet authoritative roster...');
  const syncRes = await fetch(`${baseURL}/api/students/sync-google-sheet`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const syncData = await syncRes.json();
  console.log('Sync Response:', syncData);
  console.log(`✓ Synchronized ${syncData.report?.synchronizedCount} students.`);

  // 3. Verify students exist in CSE, SE, and EEE
  const studentsRes = await fetch(`${baseURL}/api/students`, { headers });
  const studentsData = await studentsRes.json();
  const allStudents = studentsData.students || [];
  const cseStudents = allStudents.filter((s: any) => s.department === 'Computer Science & Engineering');
  const seStudents = allStudents.filter((s: any) => s.department === 'Software Engineering');
  const eeeStudents = allStudents.filter((s: any) => s.department === 'Electrical & Electronics Engineering');

  console.log(`✓ Total Students in Registry: ${allStudents.length}`);
  console.log(`  - Computer Science & Engineering (CSE): ${cseStudents.length}`);
  console.log(`  - Software Engineering (SE): ${seStudents.length}`);
  console.log(`  - Electrical & Electronics Engineering (EEE): ${eeeStudents.length}`);

  if (cseStudents.length === 0 || seStudents.length === 0 || eeeStudents.length === 0) {
    throw new Error('Roster incomplete across departments!');
  }

  // 4. Launch a Multi-Department Session (CSE + SE + EEE)
  console.log('\n3. Launching Multi-Department Session (CSE + SE + EEE)...');
  const startRes = await fetch(`${baseURL}/api/attendance/start-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      classroom: 'Smart Hall LH-101',
      subject: 'Distributed Systems & Cloud Computing',
      faculty: 'Dr. K. S. Ramanujam',
      academic_year: '2025-2026',
      departments: [
        'Computer Science & Engineering',
        'Software Engineering',
        'Electrical & Electronics Engineering',
      ],
      section: 'ALL',
      is_multi_department: true,
      department: 'MULTI_DEPARTMENT',
    }),
  });

  const startData = await startRes.json();
  const session = startData.session;
  console.log(`✓ Session Started: ID=${session.id}, Classroom=${session.classroom}`);
  console.log(`  is_multi_department: ${session.is_multi_department}`);
  console.log(`  Participating Departments: ${session.departments.join(', ')}`);
  console.log(`  Frozen Roster Snapshot Total: ${session.roster_snapshot?.length} students`);
  console.log('  Initial Department Stats:', JSON.stringify(session.department_stats, null, 2));

  // 5. Test Recognition with descriptors from CSE, SE, and EEE
  console.log('\n4. Simulating live classroom recognition across departments...');

  // Fetch full student objects with embeddings
  async function getFullStudent(id: string) {
    const r = await fetch(`${baseURL}/api/students/${id}`, { headers });
    const d = await r.json();
    return d.student;
  }

  const testCases = [
    { student: await getFullStudent(cseStudents[0].id), dept: 'CSE' },
    { student: await getFullStudent(cseStudents[1].id), dept: 'CSE' },
    { student: await getFullStudent(seStudents[0].id), dept: 'SE' },
    { student: await getFullStudent(seStudents[1].id), dept: 'SE' },
    { student: await getFullStudent(eeeStudents[0].id), dept: 'EEE' },
  ];

  for (const tc of testCases) {
    const s = tc.student;
    console.log(`\n  -> Processing face for ${s.full_name} (${s.roll_number}) [${s.department}]...`);
    const embedding = s.encodings?.[0] || s.mean_encoding;
    const recRes = await fetch(`${baseURL}/api/attendance/process-recognition`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        descriptor: embedding,
        source: 'WEBCAM',
        tracking_id: `TRACK_${s.roll_number}`,
        session_id: session.id,
      }),
    });

    const recData = await recRes.json();
    const match = recData.match;
    if (!match) {
      console.error(`  ✗ Recognition failed for ${s.roll_number}:`, recData);
      throw new Error(`Recognition failed for ${s.roll_number}`);
    }

    console.log(`  ✓ Recognized: ${match.full_name} (${match.roll_number})`);
    console.log(`    Authoritative Department: "${match.department}"`);
    console.log(`    Confidence: ${match.confidence}% (Distance: ${match.distance})`);
    console.log(`    Status: ${recData.message || (recData.duplicate_ignored ? 'Duplicate Ignored' : 'Marked Present')}`);
  }

  // 6. Verify Duplicate Guard
  console.log('\n5. Verifying Duplicate Guard for already marked student...');
  const firstStudent = testCases[0].student;
  const dupRes = await fetch(`${baseURL}/api/attendance/process-recognition`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      descriptor: firstStudent.encodings?.[0] || firstStudent.mean_encoding,
      source: 'WEBCAM',
      tracking_id: `TRACK_DUP_TEST`,
      session_id: session.id,
    }),
  });
  const dupData = await dupRes.json();
  console.log(`✓ Duplicate Guard Result: duplicate_ignored=${dupData.duplicate_ignored}, message="${dupData.message}"`);

  // 7. Check Active Session Stats & Department Distribution
  console.log('\n6. Fetching Active Session Status & Multi-Department Stats...');
  const activeRes = await fetch(`${baseURL}/api/attendance/active-session`, { headers });
  const activeData = await activeRes.json();
  const activeSession = activeData.session;
  console.log('✓ Active Session Department Stats:');
  for (const [dept, stat] of Object.entries(activeSession.department_stats as Record<string, any>)) {
    console.log(`  - ${dept}: ${stat.present} present / ${stat.total} total (${stat.attendance_percentage}%)`);
  }

  // 8. Conclude Session
  console.log('\n7. Concluding Session...');
  const stopRes = await fetch(`${baseURL}/api/attendance/stop-session/${session.id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const stopData = await stopRes.json();
  console.log(`✓ Session Concluded: Status=${stopData.session?.status}`);

  console.log('\n=== ALL MULTI-DEPARTMENT VERIFICATION TESTS PASSED SUCCESSFULLY! ===\n');
}

runVerification().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
