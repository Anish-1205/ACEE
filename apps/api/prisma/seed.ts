/**
 * Development seed: fictional people, brochure-derived (UNVERIFIED) scheme rules, courses, stages and CMS.
 * Refuses to run in production. Idempotent: wipes and recreates demo data each run.
 */
import { COUNTRY_CODES, OFFICIAL_SCHEME_URL } from '@acee/shared';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/auth';

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');

export const DEMO_PASSWORD = 'AceeDemo2026';
const L = (en: string, te: string, hi: string) => ({ en, te, hi });

async function main() {
  // Order matters for FK constraints.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.notification.deleteMany(), prisma.documentReview.deleteMany(), prisma.document.deleteMany(),
    prisma.applicationNote.deleteMany(), prisma.applicationStageHistory.deleteMany(), prisma.application.deleteMany(), prisma.applicationStage.deleteMany(),
    prisma.counselorNote.deleteMany(), prisma.appointment.deleteMany(), prisma.counselingAvailability.deleteMany(),
    prisma.attendance.deleteMany(), prisma.studyMaterial.deleteMany(), prisma.announcement.deleteMany(), prisma.enrollment.deleteMany(), prisma.batch.deleteMany(), prisma.course.deleteMany(),
    prisma.eligibilityAssessment.deleteMany(), prisma.schemeRuleVersion.deleteMany(), prisma.scholarshipScheme.deleteMany(),
    prisma.inquiry.deleteMany(), prisma.cmsContent.deleteMany(), prisma.dataRequest.deleteMany(), prisma.invitation.deleteMany(),
    prisma.consent.deleteMany(), prisma.session.deleteMany(), prisma.user.deleteMany(),
  ]);

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const mk = (email: string, fullName: string, mobile: string, role: 'STUDENT' | 'COUNSELOR' | 'TRAINER' | 'ADMIN' | 'SUPER_ADMIN', extra: object = {}) =>
    prisma.user.create({ data: { email, fullName, mobile, role, passwordHash, district: 'Hyderabad', ...extra } });

  const superAdmin = await mk('superadmin@demo.acee.test', 'Demo Super Admin', '9000000001', 'SUPER_ADMIN');
  const admin = await mk('admin@demo.acee.test', 'Demo Admin', '9000000002', 'ADMIN');
  const c1 = await mk('counselor1@demo.acee.test', 'Lakshmi Rao (Demo)', '9000000003', 'COUNSELOR', { counselorProfile: { create: { bio: 'Scholarship & admissions guidance', languages: ['en', 'te'] } } });
  const c2 = await mk('counselor2@demo.acee.test', 'Arjun Verma (Demo)', '9000000004', 'COUNSELOR', { counselorProfile: { create: { bio: 'Coaching and test planning', languages: ['en', 'hi'] } } });
  const trainer = await mk('trainer@demo.acee.test', 'Priya Nair (Demo)', '9000000005', 'TRAINER', { trainerProfile: { create: { specializations: ['IELTS', 'PTE'] } } });
  const s1 = await mk('student1@demo.acee.test', 'Ravi Kumar (Demo)', '9000000006', 'STUDENT', { district: 'Warangal', preferredLanguage: 'te', studentProfile: { create: { qualification: 'UG_COMPLETED', fieldOfStudy: 'B.Tech CSE', graduationYear: 2025, intendedCountry: 'US', intendedLevel: 'MASTERS' } } });
  const s2 = await mk('student2@demo.acee.test', 'Sunita Devi (Demo)', '9000000007', 'STUDENT', { district: 'Khammam', preferredLanguage: 'hi', studentProfile: { create: {} } });
  for (const u of [superAdmin, admin, c1, c2, trainer, s1, s2]) {
    await prisma.consent.createMany({ data: ['TERMS', 'PRIVACY'].map((p) => ({ userId: u.id, purpose: p as never, granted: true, version: '2026-11-01' })) });
  }

  // ---- Scheme: rules derived from the ACEE brochure, NOT verified against a Government Order ----
  const scheme = await prisma.scholarshipScheme.create({
    data: {
      code: 'AMBEDKAR_OVN',
      name: L('Dr. B.R. Ambedkar Overseas Vidya Nidhi', 'డా. బి.ఆర్. అంబేద్కర్ ఓవర్సీస్ విద్యా నిధి', 'डॉ. बी.आर. अंबेडकर ओवरसीज़ विद्या निधि'),
      description: L(
        'A Government of Telangana scheme that supports eligible SC and ST students pursuing higher studies abroad. ACEE brochures describe financial assistance of up to ₹20 lakh plus visa fee and one-way economy airfare reimbursement. Confirm current benefits on the official portal.',
        'విదేశాల్లో ఉన్నత విద్య అభ్యసించే అర్హులైన ఎస్సీ, ఎస్టీ విద్యార్థులకు సహాయం చేసే తెలంగాణ ప్రభుత్వ పథకం. ACEE బ్రోచర్ ప్రకారం ₹20 లక్షల వరకు ఆర్థిక సహాయం, వీసా ఫీజు మరియు ఒకవైపు ఎకానమీ విమాన ఛార్జీ రీయింబర్స్‌మెంట్ ఉంటాయి. ప్రస్తుత ప్రయోజనాలను అధికారిక పోర్టల్‌లో నిర్ధారించుకోండి.',
        'तेलंगाना सरकार की योजना जो विदेश में उच्च शिक्षा प्राप्त करने वाले पात्र SC और ST छात्रों की सहायता करती है। ACEE ब्रोशर के अनुसार ₹20 लाख तक की वित्तीय सहायता तथा वीज़ा शुल्क और एक तरफ़ा इकोनॉमी हवाई किराए की प्रतिपूर्ति मिलती है। वर्तमान लाभ आधिकारिक पोर्टल पर अवश्य जाँचें।',
      ),
      officialUrl: OFFICIAL_SCHEME_URL,
    },
  });
  const rules = [
    { id: 'residency', criterion: 'telanganaResident', operator: 'eq', threshold: true, onFail: 'NOT_MET', description: 'Must be a resident of Telangana' },
    { id: 'income', criterion: 'annualFamilyIncome', operator: 'lt', threshold: 500000, onFail: 'NOT_MET', description: 'Annual family income below ₹5,00,000' },
    { id: 'marks', criterion: 'graduationPercentage', operator: 'gte', threshold: 60, onFail: 'NOT_MET', description: 'At least 60% marks in graduation' },
    { id: 'country', criterion: 'intendedCountry', operator: 'in', threshold: COUNTRY_CODES, onFail: 'NOT_MET', description: 'Study destination must be an eligible country' },
    { id: 'admission', criterion: 'admissionStatus', operator: 'eq', threshold: 'OFFER_RECEIVED', onFail: 'REVIEW', description: 'An admission offer from a foreign university is usually required at application time' },
    { id: 'family', criterion: 'priorFamilyBenefit', operator: 'eq', threshold: false, onFail: 'REVIEW', description: 'Prior benefit to a family member may affect eligibility — needs review' },
  ];
  for (const category of ['SC', 'ST'] as const) {
    await prisma.schemeRuleVersion.create({
      data: {
        schemeId: scheme.id, category, version: 1, rules, active: true, createdById: superAdmin.id,
        sourceUrl: OFFICIAL_SCHEME_URL, goReference: 'UNVERIFIED — ACEE brochure; no Government Order number supplied',
        verifiedAt: new Date('2026-11-01'), effectiveFrom: new Date('2026-11-01'),
        notes: 'Demo rules copied from the ACEE brochure. An admin must verify each threshold against the current official GO and publish a new version before production use.',
      },
    });
  }

  // ---- Coaching ----
  const courseText: Record<string, [string, string, string, number]> = {
    IELTS: ['International English Language Testing System — listening, reading, writing and speaking practice.', 'ఇంటర్నేషనల్ ఇంగ్లీష్ లాంగ్వేజ్ టెస్టింగ్ సిస్టమ్ — లిజనింగ్, రీడింగ్, రైటింగ్, స్పీకింగ్ సాధన.', 'इंटरनेशनल इंग्लिश लैंग्वेज टेस्टिंग सिस्टम — सुनना, पढ़ना, लिखना और बोलना अभ्यास।', 6],
    PTE: ['Pearson Test of English Academic — computer-based English test preparation.', 'పియర్సన్ టెస్ట్ ఆఫ్ ఇంగ్లీష్ అకడమిక్ — కంప్యూటర్ ఆధారిత ఇంగ్లీష్ పరీక్ష సన్నద్ధత.', 'पियर्सन टेस्ट ऑफ़ इंग्लिश एकेडमिक — कंप्यूटर आधारित अंग्रेज़ी परीक्षा की तैयारी।', 6],
    TOEFL: ['Test of English as a Foreign Language — preparation for US-focused admissions.', 'టెస్ట్ ఆఫ్ ఇంగ్లీష్ యాజ్ ఎ ఫారిన్ లాంగ్వేజ్ — అమెరికా ప్రవేశాలకు సన్నద్ధత.', 'टेस्ट ऑफ़ इंग्लिश ऐज़ ए फ़ॉरेन लैंग्वेज — अमेरिका केंद्रित प्रवेश की तैयारी।', 6],
    GRE: ['Graduate Record Examinations — quantitative, verbal and analytical writing.', 'గ్రాడ్యుయేట్ రికార్డ్ ఎగ్జామినేషన్స్ — క్వాంటిటేటివ్, వెర్బల్, అనలిటికల్ రైటింగ్.', 'ग्रेजुएट रिकॉर्ड एग्ज़ामिनेशन्स — क्वांटिटेटिव, वर्बल और एनालिटिकल राइटिंग।', 10],
    GMAT: ['Graduate Management Admission Test — for business school applicants.', 'గ్రాడ్యుయేట్ మేనేజ్‌మెంట్ అడ్మిషన్ టెస్ట్ — బిజినెస్ స్కూల్ దరఖాస్తుదారులకు.', 'ग्रेजुएट मैनेजमेंट एडमिशन टेस्ट — बिज़नेस स्कूल आवेदकों के लिए।', 10],
  };
  const freeNote = L(
    'Free for students who meet ACEE\'s eligibility criteria (e.g. eligible SC/ST students of Telangana). Eligibility is confirmed by ACEE before the batch starts.',
    'ACEE అర్హత ప్రమాణాలు పాటించే విద్యార్థులకు (ఉదా. తెలంగాణ అర్హ ఎస్సీ/ఎస్టీ విద్యార్థులు) ఉచితం. బ్యాచ్ ప్రారంభానికి ముందు ACEE అర్హతను నిర్ధారిస్తుంది.',
    'ACEE के पात्रता मानदंड पूरे करने वाले छात्रों (जैसे तेलंगाना के पात्र SC/ST छात्र) के लिए निःशुल्क। बैच शुरू होने से पहले ACEE पात्रता की पुष्टि करता है।',
  );
  const today = new Date();
  const d = (days: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days));
  let firstBatchId = '';
  for (const [code, [en, te, hi, weeks]] of Object.entries(courseText)) {
    const course = await prisma.course.create({ data: { code, name: L(code, code, code), description: L(en, te, hi), durationWeeks: weeks, isFree: true, feeAmount: null, feeNote: freeNote } });
    const b1 = await prisma.batch.create({ data: { courseId: course.id, name: `${code} Morning (Online)`, mode: 'ONLINE', startDate: d(-14), endDate: d(weeks * 7), days: ['MON', 'WED', 'FRI'], startTime: '07:00', endTime: '08:30', capacity: code === 'GMAT' ? 1 : 25, trainerId: trainer.id, location: null } });
    await prisma.batch.create({ data: { courseId: course.id, name: `${code} Evening (Dilsukhnagar)`, mode: 'OFFLINE', startDate: d(14), endDate: d(14 + weeks * 7), days: ['TUE', 'THU', 'SAT'], startTime: '18:00', endTime: '19:30', capacity: 30, trainerId: trainer.id, location: 'ACEE Office, Chaitanyapuri, Dilsukhnagar' } });
    await prisma.studyMaterial.create({ data: { courseId: course.id, title: `${code} official test information`, url: `https://www.google.com/search?q=${code}+official+test+format`, description: 'Look up the official test format from the test owner\'s website.', createdById: trainer.id } });
    if (code === 'IELTS') firstBatchId = b1.id;
  }
  await prisma.enrollment.create({ data: { userId: s1.id, batchId: firstBatchId, preferredMode: 'ONLINE', status: 'CONFIRMED' } });

  // ---- Counseling hours: Mon–Sat, IST ----
  for (const c of [c1, c2]) {
    for (let dow = 1; dow <= 6; dow++) {
      await prisma.counselingAvailability.createMany({ data: [
        { counselorId: c.id, dayOfWeek: dow, startTime: '10:00', endTime: '13:00', slotMinutes: 30, mode: 'BOTH' },
        { counselorId: c.id, dayOfWeek: dow, startTime: '14:00', endTime: '17:00', slotMinutes: 30, mode: 'ONLINE' },
      ] });
    }
  }

  // ---- Application workflow ----
  const stageNames: [string, string, string, string][] = [
    ['INQUIRY_RECEIVED', 'Inquiry Received', 'విచారణ స్వీకరించబడింది', 'पूछताछ प्राप्त हुई'],
    ['PROFILE_CREATED', 'Profile Created', 'ప్రొఫైల్ సృష్టించబడింది', 'प्रोफ़ाइल बनाई गई'],
    ['ELIGIBILITY_REVIEW', 'Eligibility Review', 'అర్హత సమీక్ష', 'पात्रता समीक्षा'],
    ['DOCUMENTS_REQUESTED', 'Documents Requested', 'పత్రాలు కోరబడ్డాయి', 'दस्तावेज़ माँगे गए'],
    ['DOCUMENTS_UNDER_REVIEW', 'Documents Under Review', 'పత్రాలు సమీక్షలో ఉన్నాయి', 'दस्तावेज़ समीक्षा में हैं'],
    ['COACHING_REGISTERED', 'Coaching Registered', 'కోచింగ్‌కు నమోదైంది', 'कोचिंग में पंजीकृत'],
    ['COUNSELING_COMPLETED', 'Counseling Completed', 'కౌన్సెలింగ్ పూర్తైంది', 'काउंसलिंग पूर्ण'],
    ['UNIVERSITY_APPLICATION', 'University Application Assistance', 'విశ్వవిద్యాలయ దరఖాస్తు సహాయం', 'विश्वविद्यालय आवेदन सहायता'],
    ['ADMISSION_OFFER', 'Admission Offer Received', 'ప్రవేశ ఆఫర్ అందింది', 'प्रवेश प्रस्ताव प्राप्त'],
    ['GOVT_APPLICATION_GUIDANCE', 'Government Application Guidance', 'ప్రభుత్వ దరఖాస్తు మార్గదర్శనం', 'सरकारी आवेदन मार्गदर्शन'],
    ['STUDENT_REPORTED_SUBMISSION', 'Student-Reported Submission', 'విద్యార్థి తెలిపిన సమర్పణ', 'छात्र द्वारा बताया गया जमा'],
    ['AWAITING_GOVT_DECISION', 'Awaiting Government Decision', 'ప్రభుత్వ నిర్ణయం కోసం వేచి ఉంది', 'सरकारी निर्णय की प्रतीक्षा'],
    ['CLOSED', 'Closed / Completed', 'ముగిసింది / పూర్తైంది', 'बंद / पूर्ण'],
  ];
  const stages = [];
  for (const [i, [code, en, te, hi]] of stageNames.entries()) stages.push(await prisma.applicationStage.create({ data: { code, name: L(en, te, hi), order: (i + 1) * 10 } }));
  await prisma.application.create({
    data: {
      studentId: s1.id, stageId: stages[2]!.id, assignedCounselorId: c1.id, intendedCountry: 'US', intake: 'Fall 2027',
      pendingActions: 'Upload graduation marksheet and income certificate.',
      history: { create: [{ toStageId: stages[0]!.id, changedById: c1.id }, { fromStageId: stages[0]!.id, toStageId: stages[1]!.id, changedById: c1.id }, { fromStageId: stages[1]!.id, toStageId: stages[2]!.id, changedById: c1.id, note: 'Preliminary screening looks positive.' }] },
      notes: { create: [{ authorId: c1.id, body: 'Please upload your documents this week.', visibleToStudent: true }, { authorId: c1.id, body: 'Internal: verify income certificate date.', visibleToStudent: false }] },
    },
  });

  await prisma.inquiry.create({ data: { name: 'Demo Visitor', mobile: '9000000099', interest: 'SCHOLARSHIP', message: 'Fictional inquiry for testing.', consentAt: new Date() } });
  await prisma.announcement.create({ data: { title: L('New IELTS batch starting soon', 'కొత్త IELTS బ్యాచ్ త్వరలో ప్రారంభం', 'नया IELTS बैच जल्द शुरू'), body: L('Register from your dashboard to reserve a seat.', 'సీటు కోసం మీ డాష్‌బోర్డ్ నుండి నమోదు చేసుకోండి.', 'सीट आरक्षित करने के लिए अपने डैशबोर्ड से पंजीकरण करें।'), audience: 'PUBLIC', createdById: admin.id } });

  // ---- CMS ----
  const cms: Record<string, object> = {
    company: {
      name: 'ACEE Review Consultants Pvt. Ltd.',
      phones: ['8465903456', '9546169456'],
      address: L(
        'Pillar No. 1555, 2nd Floor, Beside Pochamma Temple Lane, Chaitanyapuri, Dilsukhnagar, Hyderabad, Telangana 500060',
        'పిల్లర్ నం. 1555, 2వ అంతస్తు, పోచమ్మ గుడి లేన్ పక్కన, చైతన్యపురి, దిల్‌సుఖ్‌నగర్, హైదరాబాద్, తెలంగాణ 500060',
        'पिलर नं. 1555, दूसरी मंज़िल, पोचम्मा मंदिर लेन के पास, चैतन्यपुरी, दिलसुखनगर, हैदराबाद, तेलंगाना 500060',
      ),
      website: 'https://www.aceereviewconsultants.com',
      hours: L('Mon–Sat, 10:00 AM – 5:00 PM', 'సోమ–శని, ఉదయం 10:00 – సాయంత్రం 5:00', 'सोम–शनि, सुबह 10:00 – शाम 5:00'),
    },
    banner: { active: true, text: L('Free counseling sessions available this month — book online.', 'ఈ నెల ఉచిత కౌన్సెలింగ్ సెషన్లు అందుబాటులో ఉన్నాయి — ఆన్‌లైన్‌లో బుక్ చేయండి.', 'इस महीने निःशुल्क काउंसलिंग सत्र उपलब्ध हैं — ऑनलाइन बुक करें।') },
    about: { body: L(
      'ACEE Review Consultants Pvt. Ltd. is a Hyderabad-based education consultancy. We help students from Telangana prepare for international English and admission tests, plan overseas study, and understand government scholarship schemes such as Dr. B.R. Ambedkar Overseas Vidya Nidhi. We are a private organisation: scholarship decisions are made only by the Government of Telangana.',
      'ACEE రివ్యూ కన్సల్టెంట్స్ ప్రై. లి. హైదరాబాద్‌కు చెందిన విద్యా కన్సల్టెన్సీ. అంతర్జాతీయ ఇంగ్లీష్ మరియు ప్రవేశ పరీక్షలకు సన్నద్ధం కావడానికి, విదేశీ చదువు ప్రణాళికకు, డా. బి.ఆర్. అంబేద్కర్ ఓవర్సీస్ విద్యా నిధి వంటి ప్రభుత్వ స్కాలర్‌షిప్ పథకాలను అర్థం చేసుకోవడానికి తెలంగాణ విద్యార్థులకు మేము సహాయం చేస్తాము. మేము ప్రైవేట్ సంస్థ: స్కాలర్‌షిప్ నిర్ణయాలు తెలంగాణ ప్రభుత్వం మాత్రమే తీసుకుంటుంది.',
      'ACEE रिव्यू कंसल्टेंट्स प्रा. लि. हैदराबाद स्थित एक शिक्षा परामर्श संस्था है। हम तेलंगाना के छात्रों को अंतरराष्ट्रीय अंग्रेज़ी और प्रवेश परीक्षाओं की तैयारी, विदेश में पढ़ाई की योजना और डॉ. बी.आर. अंबेडकर ओवरसीज़ विद्या निधि जैसी सरकारी छात्रवृत्ति योजनाओं को समझने में मदद करते हैं। हम एक निजी संस्था हैं: छात्रवृत्ति के निर्णय केवल तेलंगाना सरकार लेती है।',
    ) },
    faq: { items: [
      { q: L('Is ACEE a government office?', 'ACEE ప్రభుత్వ కార్యాలయమా?', 'क्या ACEE सरकारी कार्यालय है?'), a: L('No. ACEE is a private consultancy. Official applications are submitted on the Telangana ePASS portal and decisions are made by the Government of Telangana.', 'కాదు. ACEE ప్రైవేట్ కన్సల్టెన్సీ. అధికారిక దరఖాస్తులు తెలంగాణ ePASS పోర్టల్‌లో సమర్పించబడతాయి, నిర్ణయాలు తెలంగాణ ప్రభుత్వం తీసుకుంటుంది.', 'नहीं। ACEE एक निजी परामर्श संस्था है। आधिकारिक आवेदन तेलंगाना ePASS पोर्टल पर जमा होते हैं और निर्णय तेलंगाना सरकार लेती है।') },
      { q: L('Does the eligibility checker guarantee a scholarship?', 'అర్హత పరిశీలన స్కాలర్‌షిప్‌కు హామీ ఇస్తుందా?', 'क्या पात्रता जाँच छात्रवृत्ति की गारंटी देती है?'), a: L('No. It is a preliminary screening based on your answers. Final eligibility and selection are decided by the concerned Government of Telangana authorities.', 'లేదు. ఇది మీ సమాధానాల ఆధారంగా ప్రాథమిక పరిశీలన మాత్రమే. తుది అర్హత మరియు ఎంపికను సంబంధిత తెలంగాణ ప్రభుత్వ అధికారులు నిర్ణయిస్తారు.', 'नहीं। यह आपके उत्तरों पर आधारित प्रारंभिक जाँच है। अंतिम पात्रता और चयन तेलंगाना सरकार के संबंधित अधिकारी तय करते हैं।') },
      { q: L('Is coaching free?', 'కోచింగ్ ఉచితమా?', 'क्या कोचिंग निःशुल्क है?'), a: L('Coaching is free for students who meet ACEE\'s published criteria. Each course page shows its current fee status.', 'ACEE ప్రమాణాలు పాటించే విద్యార్థులకు కోచింగ్ ఉచితం. ప్రతి కోర్సు పేజీ ప్రస్తుత ఫీజు స్థితిని చూపుతుంది.', 'ACEE के मानदंड पूरे करने वाले छात्रों के लिए कोचिंग निःशुल्क है। हर कोर्स पेज पर वर्तमान शुल्क स्थिति दिखाई जाती है।') },
      { q: L('Which documents should I keep ready?', 'ఏ పత్రాలు సిద్ధంగా ఉంచుకోవాలి?', 'कौन से दस्तावेज़ तैयार रखने चाहिए?'), a: L('Graduation marksheets, income certificate, community certificate, university offer letter and test scores. Do not upload Aadhaar or bank details.', 'గ్రాడ్యుయేషన్ మార్కుల జాబితా, ఆదాయ ధృవీకరణ పత్రం, కుల ధృవీకరణ పత్రం, విశ్వవిద్యాలయ ఆఫర్ లెటర్, పరీక్ష స్కోర్లు. ఆధార్ లేదా బ్యాంక్ వివరాలు అప్‌లోడ్ చేయవద్దు.', 'स्नातक अंकपत्र, आय प्रमाणपत्र, जाति प्रमाणपत्र, विश्वविद्यालय प्रस्ताव पत्र और परीक्षा स्कोर। आधार या बैंक विवरण अपलोड न करें।') },
    ] },
    privacy: { body: L(
      'We collect only what we need to guide you: your name, mobile, email, district, language, the answers you give in the eligibility checker, and documents you choose to upload. We do not ask for Aadhaar, bank or passport numbers. Your documents are stored privately and are seen only by ACEE staff assigned to you; every access is logged. You can download your data or ask us to delete your account from your dashboard. Contact us to withdraw consent for messages at any time.',
      'మీకు మార్గదర్శనం చేయడానికి అవసరమైనవి మాత్రమే సేకరిస్తాము: మీ పేరు, మొబైల్, ఇమెయిల్, జిల్లా, భాష, అర్హత పరిశీలనలో మీరు ఇచ్చే సమాధానాలు, మీరు అప్‌లోడ్ చేసే పత్రాలు. ఆధార్, బ్యాంక్ లేదా పాస్‌పోర్ట్ నంబర్లు అడగము. మీ పత్రాలు గోప్యంగా నిల్వ చేయబడతాయి, మీకు కేటాయించిన ACEE సిబ్బంది మాత్రమే చూస్తారు; ప్రతి యాక్సెస్ నమోదు చేయబడుతుంది. మీ డాష్‌బోర్డ్ నుండి మీ డేటాను డౌన్‌లోడ్ చేయవచ్చు లేదా ఖాతా తొలగింపు కోరవచ్చు.',
      'हम आपका मार्गदर्शन करने के लिए केवल आवश्यक जानकारी लेते हैं: नाम, मोबाइल, ईमेल, ज़िला, भाषा, पात्रता जाँच में दिए उत्तर और आपके द्वारा अपलोड किए गए दस्तावेज़। हम आधार, बैंक या पासपोर्ट नंबर नहीं माँगते। आपके दस्तावेज़ निजी रूप से संग्रहीत होते हैं और केवल आपको सौंपे गए ACEE कर्मचारी देखते हैं; हर पहुँच दर्ज होती है। आप अपने डैशबोर्ड से अपना डेटा डाउनलोड कर सकते हैं या खाता हटाने का अनुरोध कर सकते हैं।',
    ) },
    terms: { body: L(
      'ACEE Global Education is operated by ACEE Review Consultants Pvt. Ltd., a private company. It is not a Government of Telangana website. Eligibility results are preliminary guidance only. Official scholarship applications must be made on the government portal, and final decisions rest with the concerned government authorities. Provide accurate information and upload only your own documents.',
      'ACEE గ్లోబల్ ఎడ్యుకేషన్‌ను ప్రైవేట్ కంపెనీ అయిన ACEE రివ్యూ కన్సల్టెంట్స్ ప్రై. లి. నిర్వహిస్తుంది. ఇది తెలంగాణ ప్రభుత్వ వెబ్‌సైట్ కాదు. అర్హత ఫలితాలు ప్రాథమిక మార్గదర్శనం మాత్రమే. అధికారిక స్కాలర్‌షిప్ దరఖాస్తులు ప్రభుత్వ పోర్టల్‌లోనే చేయాలి, తుది నిర్ణయాలు సంబంధిత ప్రభుత్వ అధికారులవే. సరైన సమాచారం ఇవ్వండి, మీ స్వంత పత్రాలు మాత్రమే అప్‌లోడ్ చేయండి.',
      'ACEE ग्लोबल एजुकेशन का संचालन एक निजी कंपनी ACEE रिव्यू कंसल्टेंट्स प्रा. लि. करती है। यह तेलंगाना सरकार की वेबसाइट नहीं है। पात्रता परिणाम केवल प्रारंभिक मार्गदर्शन हैं। आधिकारिक छात्रवृत्ति आवेदन सरकारी पोर्टल पर ही करें, अंतिम निर्णय संबंधित सरकारी अधिकारियों के हैं। सही जानकारी दें और केवल अपने दस्तावेज़ अपलोड करें।',
    ) },
  };
  for (const [key, content] of Object.entries(cms)) await prisma.cmsContent.create({ data: { key, content } });

  console.log(`Seeded demo data. All demo accounts use password: ${DEMO_PASSWORD}`);
}

await main();
await prisma.$disconnect();
