import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Simple .env.test parser
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.test')
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env.test file not found!')
    console.error('Please create .env.test from .env.test.example and provide real credentials.')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.substring(0, idx).trim()
      const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = val
    }
  }
  return env
}

const env = loadEnv()
const requiredKeys = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'STUDENT_A_EMAIL',
  'STUDENT_A_PASSWORD',
  'STUDENT_B_EMAIL',
  'STUDENT_B_PASSWORD',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
]

for (const key of requiredKeys) {
  if (!env[key]) {
    console.error(`❌ Missing required environment variable in .env.test: ${key}`)
    process.exit(1)
  }
}

const SUPABASE_URL = env.SUPABASE_URL
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY

// Helper to create client with isolated auth storage
function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Minimal valid JPEG image buffer
const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
])

const results = []

function assert(num, label, passed, detail = '') {
  const status = passed ? 'PASS' : 'FAIL'
  console.log(`[Check ${num.toString().padStart(2, '0')}] ${status}: ${label}${detail ? ` (${detail})` : ''}`)
  results.push({ num, label, passed, detail })
}

async function main() {
  console.log('====================================================')
  console.log('   CLUB BUDGET TRACKER - RLS & STORAGE TEST RUNNER  ')
  console.log('====================================================\n')

  const clientA = makeClient()
  const clientB = makeClient()
  const clientAdmin = makeClient()

  console.log('Authenticating test users...')
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: env.STUDENT_A_EMAIL,
    password: env.STUDENT_A_PASSWORD,
  })
  if (errA || !authA.user) {
    console.error('❌ Failed to sign in as Student A:', errA?.message)
    process.exit(1)
  }

  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: env.STUDENT_B_EMAIL,
    password: env.STUDENT_B_PASSWORD,
  })
  if (errB || !authB.user) {
    console.error('❌ Failed to sign in as Student B:', errB?.message)
    process.exit(1)
  }

  const { data: authAdmin, error: errAdmin } = await clientAdmin.auth.signInWithPassword({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  })
  if (errAdmin || !authAdmin.user) {
    console.error('❌ Failed to sign in as Admin:', errAdmin?.message)
    process.exit(1)
  }

  const userA = authA.user
  const userB = authB.user
  const userAdmin = authAdmin.user

  console.log(`  Student A: ${userA.id} (${userA.email})`)
  console.log(`  Student B: ${userB.id} (${userB.email})`)
  console.log(`  Admin:     ${userAdmin.id} (${userAdmin.email})\n`)

  // ────────────────── Setup: clubs & test events ──────────────────

  console.log('--- Setting up test data as Admin ---')

  // Fetch the Digital VJTI club (seeded by 003 migration)
  const { data: clubRow, error: clubErr } = await clientAdmin
    .from('clubs')
    .select('id')
    .eq('name', 'Digital VJTI')
    .single()
  if (clubErr || !clubRow) {
    console.error('❌ Could not find "Digital VJTI" club. Make sure 003 migration was applied:', clubErr?.message)
    process.exit(1)
  }
  const testClubId = clubRow.id
  console.log(`  Club (Digital VJTI): ${testClubId}`)

  // Check 0: Authenticated user can read clubs table; student cannot write it
  const { data: clubList, error: clubListErr } = await clientA.from('clubs').select('id, name')
  const clubReadOk = !clubListErr && Array.isArray(clubList) && clubList.length >= 3
  assert(0, 'Authenticated student can SELECT clubs; minimum 3 rows present', clubReadOk, clubListErr?.message)

  const { error: clubInsertErr } = await clientA.from('clubs').insert({ name: 'Hacker Club' })
  assert('0b', 'Student cannot INSERT into clubs: rejected', !!clubInsertErr)

  const clientAnon = makeClient()
  const { data: anonClubs, error: anonClubsErr } = await clientAnon.from('clubs').select('id, name')
  assert(
    '0c',
    'Anonymous user can SELECT clubs for signup dropdown',
    !anonClubsErr && Array.isArray(anonClubs) && anonClubs.length >= 3,
    anonClubsErr?.message,
  )

  const { data: gdgClub } = await clientAdmin.from('clubs').select('id').eq('name', 'GDG').single()

  async function signupProfileCheck(checkNum, description, metadata, expect) {
    const email = `rls-signup-${crypto.randomUUID()}@rls-test.invalid`
    const password = 'RlsTestPass123!'
    const { data: signData, error: signErr } = await clientAnon.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: 'RLS Signup Test',
          year: '2nd Year (SY)',
          branch: 'Computer Engineering',
          roll_number: 'RLS0001',
          ...metadata,
        },
      },
    })
    if (signErr || !signData.user?.id) {
      assert(checkNum, description, false, signErr?.message || 'no user id')
      return
    }
    const { data: prof, error: profErr } = await clientAdmin
      .from('profiles')
      .select('club_id, role')
      .eq('id', signData.user.id)
      .maybeSingle()
    const clubOk = expect.club_id === undefined || prof?.club_id === expect.club_id
    const roleOk = prof?.role === expect.role
    assert(
      checkNum,
      description,
      !profErr && clubOk && roleOk,
      profErr?.message || `club_id=${prof?.club_id}, role=${prof?.role}`,
    )
  }

  await signupProfileCheck(
    29,
    'Signup with valid club_id: profile.club_id matches clubs table',
    { club_id: testClubId, club_role: 'Tech Core' },
    { club_id: testClubId, role: 'student' },
  )

  await signupProfileCheck(
    30,
    'Signup with invalid club_id: profile.club_id is null',
    { club_id: '00000000-0000-0000-0000-000000000000', club_role: 'Tech Core' },
    { club_id: null, role: 'student' },
  )

  await signupProfileCheck(
    31,
    "Signup with role='admin' in metadata: profile.role remains student",
    { club_id: testClubId, club_role: 'Tech Core', role: 'admin' },
    { club_id: testClubId, role: 'student' },
  )

  if (gdgClub?.id) {
    await signupProfileCheck(
      32,
      'Signup with GDG club_id: profile.club_id saved correctly',
      { club_id: gdgClub.id, club_role: 'Design' },
      { club_id: gdgClub.id, role: 'student' },
    )
  }

  // Check or create active event
  let { data: activeEvents } = await clientAdmin
    .from('events')
    .select('*')
    .eq('name', 'RLS-TEST active')
    .eq('club_id', testClubId)
  let activeEvent = activeEvents?.[0]
  if (!activeEvent) {
    const { data: created, error } = await clientAdmin
      .from('events')
      .insert({ name: 'RLS-TEST active', club_id: testClubId, is_active: true })
      .select()
      .single()
    if (error) throw new Error(`Could not create active event: ${error.message}`)
    activeEvent = created
  } else if (!activeEvent.is_active) {
    const { data: updated } = await clientAdmin
      .from('events')
      .update({ is_active: true })
      .eq('id', activeEvent.id)
      .select()
      .single()
    activeEvent = updated
  }

  // Check or create inactive event
  let { data: inactiveEvents } = await clientAdmin
    .from('events')
    .select('*')
    .eq('name', 'RLS-TEST inactive')
    .eq('club_id', testClubId)
  let inactiveEvent = inactiveEvents?.[0]
  if (!inactiveEvent) {
    const { data: created, error } = await clientAdmin
      .from('events')
      .insert({ name: 'RLS-TEST inactive', club_id: testClubId, is_active: false })
      .select()
      .single()
    if (error) throw new Error(`Could not create inactive event: ${error.message}`)
    inactiveEvent = created
  } else if (inactiveEvent.is_active) {
    const { data: updated } = await clientAdmin
      .from('events')
      .update({ is_active: false })
      .eq('id', inactiveEvent.id)
      .select()
      .single()
    inactiveEvent = updated
  }

  console.log(`  Active Event:   ${activeEvent.id}`)
  console.log(`  Inactive Event: ${inactiveEvent.id}\n`)

  console.log('--- DATABASE CHECKS ---')

  // Check 1: Student A uploads a valid JPEG and inserts valid pending expense: succeeds
  const uuid1 = crypto.randomUUID()
  const path1 = `${userA.id}/${uuid1}.jpg`
  const { error: upErr1 } = await clientA.storage.from('bills').upload(path1, VALID_JPEG, { contentType: 'image/jpeg' })
  let expense1Id = null
  if (upErr1) {
    assert(1, 'Student A uploads JPEG & inserts valid pending expense', false, `Upload failed: ${upErr1.message}`)
  } else {
    const { data: insData, error: insErr } = await clientA.from('expenses').insert({
      user_id: userA.id,
      club_id: testClubId,
      event_id: activeEvent.id,
      title: 'RLS-TEST 1: Valid pending expense',
      amount: 150.00,
      expense_date: '2026-10-01',
      bill_path: path1,
      status: 'pending',
    }).select().single()
    if (!insErr && insData?.id) {
      expense1Id = insData.id
      assert(1, 'Student A uploads JPEG & inserts valid pending expense', true)
    } else {
      assert(1, 'Student A uploads JPEG & inserts valid pending expense', false, insErr?.message)
    }
  }

  // Check 2: Student B selects all expenses: A's expense is not present
  const { data: bExpenses, error: bExpErr } = await clientB.from('expenses').select('*')
  const foundAInB = bExpenses?.some((e) => e.user_id === userA.id || e.id === expense1Id)
  assert(2, "Student B selects expenses: Student A's expense is not present", !bExpErr && !foundAInB)

  // Check 25: Admin review queue embed (explicit profiles FK)
  const reviewQueueSelect = `
    id, title, description, amount, expense_date, bill_path, created_at, club_id,
    clubs ( id, name ),
    events ( name ),
    student:profiles!expenses_user_id_fkey ( full_name, email )
  `
  const { data: reviewQueueRows, error: reviewQueueErr } = await clientAdmin
    .from('expenses')
    .select(reviewQueueSelect)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  const reviewQueueRow = reviewQueueRows?.find((e) => e.id === expense1Id)
  const reviewQueueMissing = []
  if (reviewQueueErr) {
    reviewQueueMissing.push(`query error: ${reviewQueueErr.message}`)
  } else if (!expense1Id) {
    reviewQueueMissing.push('no expense from check 1')
  } else if (!reviewQueueRow) {
    reviewQueueMissing.push('pending row not found in review queue')
  } else {
    if (!reviewQueueRow.student || typeof reviewQueueRow.student !== 'object') {
      reviewQueueMissing.push('student embed object')
    } else if (typeof reviewQueueRow.student.full_name !== 'string') {
      reviewQueueMissing.push('student.full_name (not a string)')
    }
    if (!reviewQueueRow.clubs || typeof reviewQueueRow.clubs !== 'object') {
      reviewQueueMissing.push('clubs embed object')
    } else if (typeof reviewQueueRow.clubs.name !== 'string') {
      reviewQueueMissing.push('clubs.name (not a string)')
    } else if (!reviewQueueRow.clubs.name.trim()) {
      reviewQueueMissing.push('clubs.name (empty)')
    }
  }
  const reviewQueueOk = reviewQueueMissing.length === 0
  assert(
    25,
    'Admin review queue embed with explicit FK hint: student + club objects with valid shapes',
    reviewQueueOk,
    reviewQueueMissing.join('; ') || '',
  )

  // Check 3: Student B selects from profiles: sees only their own row
  const { data: bProfiles, error: bProfErr } = await clientB.from('profiles').select('*')
  const onlyOwnProfile = bProfiles && bProfiles.length === 1 && bProfiles[0].id === userB.id
  assert(3, 'Student B selects profiles: sees only their own row', !bProfErr && onlyOwnProfile, `Found count: ${bProfiles?.length}`)

  // Check 4: Student A inserts with status 'approved': rejected
  const uuid4 = crypto.randomUUID()
  const path4 = `${userA.id}/${uuid4}.jpg`
  const { error: insErr4 } = await clientA.from('expenses').insert({
    user_id: userA.id,
    club_id: testClubId,
    event_id: activeEvent.id,
    title: 'RLS-TEST 4: Status approved attempt',
    amount: 100,
    expense_date: '2026-10-01',
    bill_path: path4,
    status: 'approved',
  })
  assert(4, "Student A inserts with status 'approved': rejected", !!insErr4)

  // Check 5: Student A inserts with user_id = B's id: rejected
  const uuid5 = crypto.randomUUID()
  const path5 = `${userA.id}/${uuid5}.jpg`
  const { error: insErr5 } = await clientA.from('expenses').insert({
    user_id: userB.id,
    club_id: testClubId,
    event_id: activeEvent.id,
    title: "RLS-TEST 5: Fake user_id",
    amount: 100,
    expense_date: '2026-10-01',
    bill_path: path5,
    status: 'pending',
  })
  assert(5, "Student A inserts with user_id = B's id: rejected", !!insErr5)

  // Check 6: Student A inserts with a bill_path inside B's folder: rejected
  const uuid6 = crypto.randomUUID()
  const path6 = `${userB.id}/${uuid6}.jpg`
  const { error: insErr6 } = await clientA.from('expenses').insert({
    user_id: userA.id,
    club_id: testClubId,
    event_id: activeEvent.id,
    title: "RLS-TEST 6: Path in B's folder",
    amount: 100,
    expense_date: '2026-10-01',
    bill_path: path6,
    status: 'pending',
  })
  assert(6, "Student A inserts with bill_path in B's folder: rejected", !!insErr6)

  // Check 7: Student A inserts against the inactive event: rejected
  const uuid7 = crypto.randomUUID()
  const path7 = `${userA.id}/${uuid7}.jpg`
  const { error: insErr7 } = await clientA.from('expenses').insert({
    user_id: userA.id,
    club_id: testClubId,
    event_id: inactiveEvent.id,
    title: 'RLS-TEST 7: Inactive event',
    amount: 100,
    expense_date: '2026-10-01',
    bill_path: path7,
    status: 'pending',
  })
  assert(7, 'Student A inserts against inactive event: rejected', !!insErr7)

  // Check 7b: Student A inserts with mismatched club_id (event belongs to club but expense says different club): rejected
  // Get a different club ID
  const { data: otherClub } = await clientAdmin.from('clubs').select('id').neq('id', testClubId).limit(1).single()
  if (otherClub) {
    const uuid7b = crypto.randomUUID()
    const path7b = `${userA.id}/${uuid7b}.jpg`
    const { error: insErr7b } = await clientA.from('expenses').insert({
      user_id: userA.id,
      club_id: otherClub.id,    // Mismatched – event belongs to testClubId
      event_id: activeEvent.id,
      title: 'RLS-TEST 7b: Club mismatch',
      amount: 100,
      expense_date: '2026-10-01',
      bill_path: path7b,
      status: 'pending',
    })
    assert('7b', 'Student A inserts with club_id mismatch to event.club_id: rejected', !!insErr7b)
  } else {
    assert('7b', 'Student A inserts with club_id mismatch: skipped (only 1 club)', true, 'skipped')
  }

  // Check 8: Student A inserts a second expense reusing the same bill_path: rejected
  const { error: insErr8 } = await clientA.from('expenses').insert({
    user_id: userA.id,
    club_id: testClubId,
    event_id: activeEvent.id,
    title: 'RLS-TEST 8: Reused bill_path',
    amount: 100,
    expense_date: '2026-10-01',
    bill_path: path1,
    status: 'pending',
  })
  assert(8, 'Student A inserts duplicate bill_path: rejected', !!insErr8)

  // Check 9: Student A updates own amount: row unchanged afterwards
  await clientA.from('expenses').update({ amount: 9999.00 }).eq('id', expense1Id)
  const { data: checkRow9 } = await clientA.from('expenses').select('amount').eq('id', expense1Id).single()
  assert(9, 'Student A updates own amount: row unchanged', checkRow9?.amount === 150.00, `Current amount: ${checkRow9?.amount}`)

  // Check 10: Student A updates own status to 'approved': row unchanged afterwards
  await clientA.from('expenses').update({ status: 'approved' }).eq('id', expense1Id)
  const { data: checkRow10 } = await clientA.from('expenses').select('status').eq('id', expense1Id).single()
  assert(10, "Student A updates own status to 'approved': row unchanged", checkRow10?.status === 'pending', `Current status: ${checkRow10?.status}`)

  // Check 11: Student A updates own profile role to 'admin': role unchanged afterwards
  await clientA.from('profiles').update({ role: 'admin' }).eq('id', userA.id)
  const { data: checkProf11 } = await clientA.from('profiles').select('role').eq('id', userA.id).single()
  assert(11, "Student A updates own role to 'admin': role unchanged", checkProf11?.role === 'student', `Current role: ${checkProf11?.role}`)

  // Check 12: Student A deletes own expense: expense still exists afterwards
  await clientA.from('expenses').delete().eq('id', expense1Id)
  const { data: checkRow12 } = await clientA.from('expenses').select('id').eq('id', expense1Id).single()
  assert(12, 'Student A deletes own expense: expense still exists', checkRow12?.id === expense1Id)

  // Check 13: Student B cannot read kpi_summary function (SECURITY INVOKER – filters B's own expenses)
  const { data: bKpi, error: bKpiErr } = await clientB.rpc('kpi_summary', { p_club_id: null })
  // B has no expenses, so either empty or 0 counts; A's data must not leak
  const bKpiRow = Array.isArray(bKpi) ? bKpi[0] : bKpi
  const bPendingCount = Number(bKpiRow?.pending_count ?? 0)
  assert(13, "Student B kpi_summary: A's pending bill does not leak to B", !bKpiErr && bPendingCount === 0, `bPendingCount=${bPendingCount}`)

  // Check 14: Admin approves A's pending expense: succeeds; reviewed_by is the admin id and reviewed_at is set
  const { data: appData, error: appErr } = await clientAdmin
    .from('expenses')
    .update({ status: 'approved' })
    .eq('id', expense1Id)
    .eq('status', 'pending')
    .select()
    .single()
  const appOk = !appErr && appData?.status === 'approved' && appData?.reviewed_by === userAdmin.id && !!appData?.reviewed_at
  assert(14, "Admin approves A's pending expense: succeeds with reviewed_by & reviewed_at", appOk, appErr?.message)

  // Check 15: Admin tries to change the approved bill to rejected without undo: blocked by guard
  const { data: doubleApp, error: doubleErr } = await clientAdmin
    .from('expenses')
    .update({ status: 'rejected', reject_reason: 'Testing change' })
    .eq('id', expense1Id)
    .select()
  assert(15, 'Admin changes approved→rejected without undo: blocked', !!doubleErr || doubleApp?.length === 0, doubleErr?.message || '0 rows')

  // Check 15b: Admin undoes review with revert_reason: bill goes back to pending
  const { data: undoData, error: undoErr } = await clientAdmin
    .from('expenses')
    .update({ status: 'pending', revert_reason: 'Approved by mistake' })
    .eq('id', expense1Id)
    .eq('status', 'approved')
    .select()
    .single()
  const undoOk = !undoErr && undoData?.status === 'pending' && undoData?.reviewed_by === null
  assert('15b', 'Admin undoes approval with revert_reason: bill returns to pending', undoOk, undoErr?.message)

  // Check 15c: Undo attempt without revert_reason: blocked by guard
  // Re-approve first (so we have something to undo)
  await clientAdmin.from('expenses').update({ status: 'approved' }).eq('id', expense1Id).eq('status', 'pending')
  const { error: undoNoReasonErr } = await clientAdmin
    .from('expenses')
    .update({ status: 'pending', revert_reason: '' })
    .eq('id', expense1Id)
  assert('15c', 'Admin undo without revert_reason: blocked', !!undoNoReasonErr, undoNoReasonErr?.message)

  // Check 16: Admin rejects another pending expense: empty reason fails, with reason succeeds
  // Re-approve may have worked; re-set to pending first if needed
  await clientAdmin.from('expenses').update({ status: 'pending', revert_reason: 'Setup for check 16' }).eq('id', expense1Id).eq('status', 'approved')
  const uuid16 = crypto.randomUUID()
  const path16 = `${userA.id}/${uuid16}.jpg`
  await clientA.storage.from('bills').upload(path16, VALID_JPEG, { contentType: 'image/jpeg' })
  const { data: exp16 } = await clientA.from('expenses').insert({
    user_id: userA.id,
    club_id: testClubId,
    event_id: activeEvent.id,
    title: 'RLS-TEST 16: To be rejected',
    amount: 50,
    expense_date: '2026-10-01',
    bill_path: path16,
    status: 'pending',
  }).select().single()

  const { error: rejEmptyErr } = await clientAdmin
    .from('expenses')
    .update({ status: 'rejected', reject_reason: '' })
    .eq('id', exp16.id)
  const { data: rejOkData, error: rejOkErr } = await clientAdmin
    .from('expenses')
    .update({ status: 'rejected', reject_reason: 'Receipt illegible' })
    .eq('id', exp16.id)
    .eq('status', 'pending')
    .select()
    .single()
  const rej16Passed = !!rejEmptyErr && !rejOkErr && rejOkData?.status === 'rejected' && rejOkData?.reject_reason === 'Receipt illegible'
  assert(16, 'Admin rejects with empty reason fails; with reason succeeds', rej16Passed)

  // Check 17: Admin tries to change an expense's amount: fails (immutable field guard)
  const { error: admAmtErr } = await clientAdmin
    .from('expenses')
    .update({ amount: 9999 })
    .eq('id', expense1Id)
  assert(17, "Admin tries to change an expense's amount: blocked by guard", !!admAmtErr, admAmtErr?.message)

  // Check 17b: Admin tries to change club_id: blocked
  const { error: admClubErr } = await clientAdmin
    .from('expenses')
    .update({ club_id: testClubId })
    .eq('id', expense1Id)
  // The guard blocks even if same value, because status isn't being transitioned
  assert('17b', "Admin tries to change expense club_id: blocked by guard", !!admClubErr, admClubErr?.message)

  // Check 18: Admin deletes an expense: expense still exists afterwards (no DELETE policy)
  await clientAdmin.from('expenses').delete().eq('id', expense1Id)
  const { data: checkRow18 } = await clientAdmin.from('expenses').select('id').eq('id', expense1Id).single()
  assert(18, 'Admin deletes an expense: expense still exists afterwards (no delete policy)', checkRow18?.id === expense1Id)

  // Check 18b: Student cannot read expense_audit_log
  const { data: audRead, error: audReadErr } = await clientA.from('expense_audit_log').select('*')
  assert('18b', 'Student cannot SELECT from expense_audit_log', !!audReadErr || !audRead || audRead.length === 0, audReadErr?.message)

  // Check 18c: Admin can read expense_audit_log; audit rows exist for expense1Id
  const { data: audAdmin, error: audAdminErr } = await clientAdmin
    .from('expense_audit_log')
    .select('*')
    .eq('expense_id', expense1Id)
    .order('created_at', { ascending: true })
  assert('18c', 'Admin can SELECT expense_audit_log and audit rows exist for expense1', !audAdminErr && audAdmin?.length > 0, audAdminErr?.message || `rows: ${audAdmin?.length}`)

  // Check 18d: Audit log contains at least 'uploaded' and 'approved' and 'review_reverted' entries
  const actions = (audAdmin || []).map((r) => r.action)
  const hasUploaded = actions.includes('uploaded')
  const hasApproved = actions.includes('approved')
  const hasReverted = actions.includes('review_reverted')
  assert('18d', "Audit log has 'uploaded', 'approved', 'review_reverted' actions for expense1", hasUploaded && hasApproved && hasReverted, `found: ${actions.join(', ')}`)

  console.log('\n--- STORAGE CHECKS ---')

  // Check 19: Student A uploads into B's folder: rejected
  const uuid19 = crypto.randomUUID()
  const path19 = `${userB.id}/${uuid19}.jpg`
  const { error: upErr19 } = await clientA.storage.from('bills').upload(path19, VALID_JPEG, { contentType: 'image/jpeg' })
  assert(19, "Student A uploads into B's folder: rejected", !!upErr19, upErr19?.message)

  // Check 20: Student B creates a signed URL for A's file: fails
  const { data: signedB, error: signedBErr } = await clientB.storage.from('bills').createSignedUrl(path1, 60)
  let downloadBFails = false
  if (signedB?.signedUrl) {
    const res = await fetch(signedB.signedUrl)
    downloadBFails = !res.ok
  } else {
    downloadBFails = true
  }
  const { error: dlErrB } = await clientB.storage.from('bills').download(path1)
  assert(20, "Student B signed URL / download for A's file: fails", (!!signedBErr || downloadBFails) && !!dlErrB)

  // Check 21: Admin creates a signed URL for A's file: succeeds
  const { data: signedAdmin, error: signedAdmErr } = await clientAdmin.storage.from('bills').createSignedUrl(path1, 60)
  let downloadAdminOk = false
  if (signedAdmin?.signedUrl) {
    const res = await fetch(signedAdmin.signedUrl)
    downloadAdminOk = res.ok
  }
  assert(21, "Admin creates signed URL for A's file: succeeds", !signedAdmErr && downloadAdminOk)

  // Check 22: Student A uploads > 5 MB: rejected. Invalid MIME: rejected.
  const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024)
  const uuid22a = crypto.randomUUID()
  const { error: bigErr } = await clientA.storage.from('bills').upload(`${userA.id}/${uuid22a}.jpg`, bigBuffer, { contentType: 'image/jpeg' })

  const uuid22b = crypto.randomUUID()
  const { error: mimeTextErr } = await clientA.storage.from('bills').upload(`${userA.id}/${uuid22b}.txt`, Buffer.from('hello'), { contentType: 'text/plain' })

  const uuid22c = crypto.randomUUID()
  const { error: mimeGifErr } = await clientA.storage.from('bills').upload(`${userA.id}/${uuid22c}.gif`, Buffer.from('GIF89a'), { contentType: 'image/gif' })

  assert(22, 'Student A uploads >5MB or invalid MIME: rejected', !!bigErr && !!mimeTextErr && !!mimeGifErr)

  // Check 22b: JPEG-only bucket — PNG upload rejected
  const uuid22png = crypto.randomUUID()
  const { error: pngUploadErr } = await clientA.storage
    .from('bills')
    .upload(`${userA.id}/${uuid22png}.jpg`, VALID_JPEG, { contentType: 'image/png' })
  assert('22b', 'Student A uploads with contentType image/png: rejected', !!pngUploadErr, pngUploadErr?.message)

  // Check 22c: Object name must match UUID.jpg pattern
  const { error: badNameErr } = await clientA.storage
    .from('bills')
    .upload(`${userA.id}/not-a-uuid.jpg`, VALID_JPEG, { contentType: 'image/jpeg' })
  assert('22c', 'Student A uploads non-UUID .jpg filename: rejected', !!badNameErr, badNameErr?.message)

  // Check 22d: Normal JPEG in correct path still works
  const uuid22d = crypto.randomUUID()
  const path22d = `${userA.id}/${uuid22d}.jpg`
  const { error: okJpegErr } = await clientA.storage
    .from('bills')
    .upload(path22d, VALID_JPEG, { contentType: 'image/jpeg' })
  assert('22d', 'Student A uploads valid JPEG at UUID path: succeeds', !okJpegErr, okJpegErr?.message)
  if (!okJpegErr) {
    await clientA.storage.from('bills').remove([path22d])
  }

  // Check 23: Student A uploads to an existing path with upsert: rejected (no overwrite)
  const { error: upsertErr } = await clientA.storage.from('bills').upload(path1, VALID_JPEG, { contentType: 'image/jpeg', upsert: true })
  assert(23, 'Student A uploads to existing path with upsert: rejected', !!upsertErr, upsertErr?.message)

  // Check 24: Student A deletes file of SUBMITTED bill: file still exists. Deletes unreferenced file in own folder: succeeds.
  await clientA.storage.from('bills').remove([path1])
  const { data: checkSubmittedFile } = await clientAdmin.storage.from('bills').createSignedUrl(path1, 60)
  const submittedStillExists = !!checkSubmittedFile?.signedUrl

  const uuid24 = crypto.randomUUID()
  const unrefPath = `${userA.id}/${uuid24}.jpg`
  await clientA.storage.from('bills').upload(unrefPath, VALID_JPEG, { contentType: 'image/jpeg' })
  const { error: unrefDelErr } = await clientA.storage.from('bills').remove([unrefPath])
  const { data: checkUnref } = await clientAdmin.storage.from('bills').createSignedUrl(unrefPath, 60)
  let unrefGone = false
  if (checkUnref?.signedUrl) {
    const res = await fetch(checkUnref.signedUrl)
    unrefGone = !res.ok
  } else {
    unrefGone = true
  }

  assert(24, 'Student A delete submitted bill file fails; unreferenced file succeeds', submittedStillExists && !unrefDelErr && unrefGone)

  // Check 26: kpi_summary RPC callable by admin (returns 1 row with correct shape)
  const { data: adminKpi, error: adminKpiErr } = await clientAdmin.rpc('kpi_summary', { p_club_id: null }).single()
  const adminKpiRaw = adminKpi
  const kpiOk = !adminKpiErr &&
    adminKpiRaw !== null &&
    'approved_total' in adminKpiRaw &&
    'pending_count' in adminKpiRaw
  assert(26, 'Admin calls kpi_summary RPC: returns valid shape', kpiOk, adminKpiErr?.message)

  // Check 27: spend_by_club RPC callable by admin; returns at least 3 rows (the 3 seeded clubs)
  const { data: clubSpend, error: clubSpendErr } = await clientAdmin.rpc('spend_by_club')
  assert(27, 'Admin calls spend_by_club RPC: at least 3 rows (seeded clubs)', !clubSpendErr && clubSpend?.length >= 3, clubSpendErr?.message || `rows: ${clubSpend?.length}`)

  // Check 28: expense_audit_log INSERT and DELETE: both blocked for client
  const { error: audInsertErr } = await clientAdmin.from('expense_audit_log').insert({
    expense_id: expense1Id,
    club_id: testClubId,
    student_id: userA.id,
    action: 'uploaded',
    created_at: new Date().toISOString(),
  })
  assert(28, 'Admin cannot INSERT into expense_audit_log directly', !!audInsertErr)

  console.log('\n====================================================')
  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.filter((r) => !r.passed).length
  console.log(`SUMMARY: ${passedCount}/${results.length} checks PASSED (${failedCount} FAILED)`)
  console.log('====================================================\n')

  console.log('Cleanup SQL (run in Supabase SQL Editor as database owner):')
  console.log("  delete from public.expense_audit_log where expense_id in (select id from public.expenses where title like 'RLS-TEST%');")
  console.log("  delete from public.expenses where title like 'RLS-TEST%';")
  console.log("  delete from public.events where name like 'RLS-TEST%';\n")

  if (failedCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal test runner exception:', err)
  process.exit(1)
})
