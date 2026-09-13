const seedStudents = [
  { id: 1, name: "Aarav Sharma", email: "aarav.sharma@campusly.edu", program: "Computer Science", year: "3rd year", joined: "2022-09-05", status: "Active" },
  { id: 2, name: "Ananya Iyer", email: "ananya.iyer@campusly.edu", program: "Business Administration", year: "4th year", joined: "2021-09-06", status: "Active" },
  { id: 3, name: "Vivaan Patel", email: "vivaan.patel@campusly.edu", program: "Design & Media", year: "2nd year", joined: "2023-09-04", status: "On leave" },
  { id: 4, name: "Diya Nair", email: "diya.nair@campusly.edu", program: "Engineering", year: "4th year", joined: "2021-09-06", status: "Active" },
  { id: 5, name: "Arjun Mehta", email: "arjun.mehta@campusly.edu", program: "Computer Science", year: "1st year", joined: "2024-09-02", status: "Active" },
  { id: 6, name: "Kavya Reddy", email: "kavya.reddy@campusly.edu", program: "Engineering", year: "3rd year", joined: "2022-09-05", status: "Inactive" }
];

const seedCourses = [
  { id: 1, code: "CS301", name: "Data Structures", instructor: "Dr. Priya Kapoor", schedule: "Mon & Wed, 10:00 AM", students: 28 },
  { id: 2, code: "BA204", name: "Business Analytics", instructor: "Prof. Rohan Malhotra", schedule: "Tue & Thu, 1:00 PM", students: 24 },
  { id: 3, code: "EN210", name: "Engineering Design", instructor: "Dr. Neha Joshi", schedule: "Friday, 9:00 AM", students: 19 }
];

const seedAttendance = seedStudents.map((student, index) => ({
  id: student.id,
  studentId: student.id,
  date: new Date().toISOString().slice(0, 10),
  status: index === 2 ? "Absent" : "Present"
}));

const storedSettings = JSON.parse(localStorage.getItem("campusly-settings") || "null");
const fallback = {
  students: JSON.parse(localStorage.getItem("campusly-students") || "null") || seedStudents,
  courses: JSON.parse(localStorage.getItem("campusly-courses") || "null") || seedCourses,
  attendance: JSON.parse(localStorage.getItem("campusly-attendance") || "null") || seedAttendance,
  settings: Array.isArray(storedSettings)
    ? storedSettings
    : [{ id: 1, ...(storedSettings || { institution: "Campusly University", academicYear: "2024 / 2025", email: "admin@campusly.edu" }) }]
};
if (!localStorage.getItem("campusly-indian-names-v1")) {
  fallback.students = fallback.students.map(student => {
    const replacement = seedStudents.find(seed => seed.id === student.id);
    return replacement && ["Olivia Bennett", "Ethan Williams", "Mia Anderson", "Noah Thompson", "Sophia Martinez", "Lucas Johnson"].includes(student.name)
      ? { ...student, name: replacement.name, email: replacement.email }
      : student;
  });
  fallback.courses = fallback.courses.map(course => {
    const replacement = seedCourses.find(seed => seed.id === course.id);
    return replacement && ["Dr. Priya Shah", "Prof. James Lee", "Dr. Robert Kim"].includes(course.instructor)
      ? { ...course, instructor: replacement.instructor }
      : course;
  });
  localStorage.setItem("campusly-students", JSON.stringify(fallback.students));
  localStorage.setItem("campusly-courses", JSON.stringify(fallback.courses));
}

let db;
const dbReady = new Promise(resolve => {
  if (!window.indexedDB) return resolve(null);
  const request = indexedDB.open("campusly-db", 1);
  request.onupgradeneeded = () => ["students", "courses", "attendance", "settings"].forEach(store => {
    if (!request.result.objectStoreNames.contains(store)) {
      request.result.createObjectStore(store, { keyPath: "id" });
    }
  });
  request.onsuccess = () => {
    db = request.result;
    const migrated = localStorage.getItem("campusly-indian-names-v1");
    if (migrated) return resolve(db);
    const transaction = db.transaction(["students", "courses"], "readwrite");
    const students = transaction.objectStore("students");
    const courses = transaction.objectStore("courses");
    seedStudents.forEach(student => students.get(student.id).onsuccess = event => {
      if (event.target.result) students.put({ ...event.target.result, name: student.name, email: student.email });
    });
    seedCourses.forEach(course => courses.get(course.id).onsuccess = event => {
      if (event.target.result) courses.put({ ...event.target.result, instructor: course.instructor });
    });
    transaction.oncomplete = () => {
      localStorage.setItem("campusly-indian-names-v1", "true");
      resolve(db);
    };
    transaction.onerror = () => resolve(db);
  };
  request.onerror = () => resolve(null);
});

async function read(store) {
  await dbReady;
  if (!db) return fallback[store];
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => {
      if (request.result.length) return resolve(request.result);
      const values = fallback[store];
      const transaction = db.transaction(store, "readwrite");
      values.forEach(value => transaction.objectStore(store).put(value));
      transaction.oncomplete = () => resolve(values);
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function write(store, values) {
  fallback[store] = values;
  localStorage.setItem(`campusly-${store}`, JSON.stringify(values));
  await dbReady;
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).clear().onsuccess = () => values.forEach(value => transaction.objectStore(store).put(value));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function data() {
  return {
    students: await read("students"),
    courses: await read("courses"),
    attendance: await read("attendance"),
    settings: (await read("settings"))[0]
  };
}
