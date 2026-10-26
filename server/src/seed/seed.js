import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import Option, { keyOf } from "../models/Option.js";
import JobRole from "../models/JobRole.js";
import Company from "../models/Company.js";
import PlacementDrive from "../models/PlacementDrive.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";

const s = (name, weight = 1) => ({ name, weight });

const ROLES = [
  { title: "Full Stack Developer", category: "Software", description: "Builds complete web applications, front to back.",
    requiredSkills: [s("JavaScript", 3), s("React", 3), s("Node.js", 3), s("Express", 2), s("MongoDB", 2), s("HTML", 1), s("CSS", 1), s("Git", 2), s("REST APIs", 2), s("TypeScript", 1), s("Docker", 1)] },
  { title: "Frontend Developer", category: "Software", description: "Builds responsive, accessible user interfaces.",
    requiredSkills: [s("JavaScript", 3), s("React", 3), s("HTML", 2), s("CSS", 2), s("TypeScript", 2), s("Git", 2), s("REST APIs", 1), s("Testing", 1), s("Figma", 1)] },
  { title: "Backend Developer", category: "Software", description: "Designs APIs, databases and server logic.",
    requiredSkills: [s("Node.js", 3), s("Express", 2), s("SQL", 3), s("MongoDB", 2), s("REST APIs", 3), s("Git", 2), s("Docker", 2), s("Data Structures", 3), s("System Design", 1)] },
  { title: "Data Analyst", category: "Data", description: "Turns data into insights and dashboards.",
    requiredSkills: [s("SQL", 3), s("Excel", 2), s("Python", 3), s("Pandas", 2), s("Statistics", 2), s("Power BI", 2), s("Tableau", 1), s("Data Visualization", 2)] },
  { title: "Data Scientist", category: "Data", description: "Builds predictive models from data.",
    requiredSkills: [s("Python", 3), s("Machine Learning", 3), s("Statistics", 3), s("Pandas", 2), s("NumPy", 2), s("Scikit-learn", 2), s("SQL", 2), s("Deep Learning", 1)] },
  { title: "DevOps Engineer", category: "Infrastructure", description: "Automates build, deploy and operations.",
    requiredSkills: [s("Linux", 3), s("Docker", 3), s("Kubernetes", 2), s("CI/CD", 3), s("Git", 2), s("AWS", 2), s("Bash", 2), s("Terraform", 1)] },
  { title: "Software Engineer (Java)", category: "Software", description: "Builds enterprise back-end systems in Java.",
    requiredSkills: [s("Java", 3), s("Data Structures", 3), s("SQL", 2), s("Spring Boot", 2), s("OOP", 2), s("Git", 1), s("REST APIs", 2)] },
];


const q = (category, question, options, answerIndex, explanation) => ({ category, question, options, answerIndex, explanation });

const APTITUDE = [
  q("quantitative", "A train 150 m long passes a pole in 15 seconds. What is its speed in km/h?", ["30", "36", "40", "45"], 1, "150 m / 15 s = 10 m/s. Multiply by 3.6 to get 36 km/h."),
  q("quantitative", "What is 20% of 20% of 500?", ["50", "25", "20", "100"], 2, "20% of 500 = 100, and 20% of 100 = 20."),
  q("quantitative", "The average of five numbers is 24. When one number is removed, the average of the remaining four is 22. What number was removed?", ["32", "28", "30", "34"], 0, "Total = 120. Remaining total = 88. Removed number = 120 - 88 = 32."),
  q("quantitative", "An item bought for Rs 800 is sold for Rs 920. What is the profit percentage?", ["12%", "18%", "20%", "15%"], 3, "Profit = 120. 120 / 800 x 100 = 15%."),
  q("quantitative", "A can finish a job in 12 days and B in 24 days. How many days will they take working together?", ["6", "9", "8", "10"], 2, "Combined rate = 1/12 + 1/24 = 3/24 = 1/8, so 8 days."),
  q("quantitative", "What is the next number in the series 2, 6, 12, 20, 30, ...?", ["40", "42", "44", "36"], 1, "The differences are 4, 6, 8, 10, so the next difference is 12 and the next term is 42."),
  q("quantitative", "The ratio of boys to girls in a class is 3:2. If the class has 30 students, how many are girls?", ["12", "10", "15", "18"], 0, "Girls = 2/5 x 30 = 12."),
  q("quantitative", "What is the simple interest on Rs 5,000 at 8% per annum for 3 years?", ["1,000", "1,500", "1,200", "1,600"], 2, "SI = 5000 x 8 x 3 / 100 = 1,200."),
  q("logical", "All roses are flowers. Some flowers fade quickly. Which conclusion MUST be true?", ["All roses fade quickly", "Some roses fade quickly", "No rose fades quickly", "None of these must be true"], 3, "The flowers that fade quickly might not include any roses, so none of the first three follows."),
  q("logical", "Pointing to a photograph, Ravi says, \"She is the daughter of my grandfather's only son.\" How is she related to Ravi?", ["Cousin", "Aunt", "Sister", "Niece"], 2, "Ravi's grandfather's only son is Ravi's father. His daughter is Ravi's sister."),
  q("logical", "In a certain code, CAT is written as DBU. How is DOG written in that code?", ["DPH", "EPH", "EOH", "CNF"], 1, "Each letter moves one step forward: D to E, O to P, G to H."),
  q("logical", "Find the odd one out: 16, 25, 36, 49, 58", ["16", "36", "58", "49"], 2, "All the others are perfect squares. 58 is not."),
  q("logical", "If the day after tomorrow is Monday, what day is it today?", ["Friday", "Sunday", "Thursday", "Saturday"], 3, "Two days before Monday is Saturday."),
  q("logical", "All engineers are graduates. All graduates are literate. Conclusion: All engineers are literate.", ["Cannot be determined", "False", "True", "Partly true"], 2, "Engineers are inside graduates, and graduates are inside literate people, so the conclusion follows."),
  q("verbal", "Choose the word closest in meaning to CANDID.", ["Secretive", "Rude", "Shy", "Frank"], 3, "Candid means honest and direct, which is the meaning of frank."),
  q("verbal", "Choose the word opposite in meaning to SCARCE.", ["Plentiful", "Rare", "Costly", "Tiny"], 0, "Scarce means in short supply. Plentiful is the opposite."),
  q("verbal", "Fill in the blank: The committee ___ its decision yesterday.", ["announce", "announcing", "announced", "have announce"], 2, "The action finished in the past, so the past tense announced is correct."),
  q("verbal", "Fill in the blank: She is very good ___ mathematics.", ["in", "at", "on", "with"], 1, "The correct phrase is good at."),
  q("verbal", "Choose the correctly spelled word.", ["Accomodate", "Acommodate", "Accommodate", "Acomodate"], 2, "Accommodate has a double c and a double m."),
  q("verbal", "What does the idiom \"to break the ice\" mean?", ["To damage something frozen", "To end a friendship", "To feel very cold", "To start a conversation in an awkward social setting"], 3, "It means to ease tension and get a conversation started."),
];

await mongoose.connect(process.env.MONGO_URI);

for (const r of ROLES) await JobRole.updateOne({ title: r.title }, r, { upsert: true });
console.log(`Job roles: ${ROLES.length}`);

for (const a of APTITUDE) await AptitudeQuestion.updateOne({ question: a.question }, a, { upsert: true });
console.log(`Aptitude questions: ${APTITUDE.length}`);

async function ensureUser(name, email, password, role) {
  let u = await User.findOne({ email });
  if (!u) u = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12), emailVerified: true, emailVerifiedAt: new Date() });
  return u;
}

// Starter choices for the student drop-downs. A list that already has items is left alone, so nothing the officer added is touched.
const year = new Date().getFullYear();
const DEFAULT_LISTS = {
  department: ["Computer Science", "Information Technology", "Electronics and Communication", "Electrical and Electronics", "Mechanical Engineering", "Civil Engineering", "Artificial Intelligence and Data Science"],
  batch: [year - 1, year, year + 1, year + 2, year + 3].map(String),
};
// Programmes belong to a department (students only see the programmes of their own department)
const DEFAULT_PROGRAMS = {
  "Computer Science": ["B.Tech", "M.Tech", "MCA", "BCA"],
  "Information Technology": ["B.Tech", "M.Tech"],
  "Electronics and Communication": ["B.Tech", "M.Tech"],
  "Electrical and Electronics": ["B.Tech", "M.Tech"],
  "Mechanical Engineering": ["B.Tech", "M.Tech"],
  "Civil Engineering": ["B.Tech", "M.Tech"],
  "Artificial Intelligence and Data Science": ["B.Tech", "M.Tech"],
};
for (const [type, values] of Object.entries(DEFAULT_LISTS)) {
  if (await Option.exists({ type })) continue;
  for (const value of values) await Option.updateOne({ type, key: keyOf(value) }, { $setOnInsert: { type, value, key: keyOf(value) } }, { upsert: true });
}
if (!(await Option.exists({ type: "program" }))) {
  for (const [department, values] of Object.entries(DEFAULT_PROGRAMS)) {
    for (const value of values) await Option.updateOne({ type: "program", department, key: keyOf(value) }, { $setOnInsert: { type: "program", value, key: keyOf(value), department } }, { upsert: true });
  }
}
console.log("Drop-down lists ready (departments, batches, programmes).");

const officer = await ensureUser("Placement Officer", "officer@demo.com", "Officer@123", "officer");
const student = await ensureUser("Asha Nair", "student@demo.com", "Student@123", "student");

await StudentProfile.updateOne({ user: student._id }, {
  $setOnInsert: {
    rollNo: "CS21001", department: "Computer Science", program: "B.Tech", batch: "2026", cgpa: 8.2, backlogs: 0, phone: "9876543210",
    links: { github: "https://github.com/asha-demo", linkedin: "https://linkedin.com/in/asha-demo" },
    education: [{ degree: "B.Tech Computer Science", institution: "Demo Institute of Technology", year: "2022-2026", score: "CGPA 8.2" }],
    skills: [{ name: "JavaScript", level: "Advanced" }, { name: "React", level: "Intermediate" }, { name: "Node.js", level: "Intermediate" }, { name: "MongoDB", level: "Intermediate" }, { name: "Git", level: "Intermediate" }],
    projects: [{ title: "Campus Marketplace", description: "Marketplace web app for students to buy and sell items.", techStack: ["React", "Node.js", "MongoDB"] }],
    certifications: [{ title: "Meta Front-End Developer", issuer: "Coursera", date: "2025" }],
    targetRole: "Full Stack Developer", interests: ["Web development", "Open source"],
  },
}, { upsert: true });

const company = await Company.findOneAndUpdate({ name: "Acme Technologies" }, {
  name: "Acme Technologies", industry: "Software", website: "https://example.com", roles: ["Software Engineer"], packageRange: "6-9 LPA",
  description: "Demo recruiter.", createdBy: officer._id,
}, { upsert: true, new: true });

if (!(await PlacementDrive.exists({ company: company._id }))) {
  await PlacementDrive.create({
    company: company._id, title: "Acme Campus Drive 2026", role: "Software Engineer", package: "6-9 LPA", location: "Bengaluru",
    date: new Date(Date.now() + 14 * 864e5), deadline: new Date(Date.now() + 10 * 864e5),
    eligibility: { minCgpa: 7, maxBacklogs: 0, departments: [] }, rounds: ["Online test", "Technical interview", "HR"], status: "upcoming", createdBy: officer._id,
  });
}

console.log("\nSeed complete. Demo logins:\n  officer@demo.com / Officer@123\n  student@demo.com / Student@123");
await mongoose.disconnect();
