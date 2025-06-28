import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc, 
    collection, 
    query, 
    orderBy, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// TEMPORARY FIX: Hardcoded Firebase Config.
const tempFirebaseConfig = {
    apiKey: "AIzaSyAkC9lIUXO4LOgpANFcwQ9Mq1-VoM7LM-4",
    authDomain: "edubio-93bd2.firebaseapp.com",
    projectId: "edubio-93bd2",
    storageBucket: "edubio-93bd2.firebasestorage.app",
    messagingSenderId: "852534968721",
    appId: "1:852534968721:web:d785665b7f144244b4da30",
    measurementId: "G-KHFZKE5X78"
};

const finalFirebaseConfig = (Object.keys(firebaseConfig).length === 0 && firebaseConfig.constructor === Object) ? tempFirebaseConfig : firebaseConfig;

// Initialize Firebase
const app = initializeApp(finalFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null; // Store current user object

// ** NEW: Google Apps Script Web App URL **
// URL ของ Web App ที่คุณคัดลอกมาจากการ Deploy Google Apps Script
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbymhqfn_R_bpWKRL2ClDKZofpLYJ77p-dBPYYFiwxKY5Ga9eMpkdqmOEQSOPEaT-PFV/exec'; 

// Function to show custom message box
function showMessageBox(title, message, callback = null) {
    const messageBox = document.getElementById("messageBox");
    if (messageBox) {
        document.getElementById("messageBoxTitle").textContent = title;
        document.getElementById("messageBoxBody").textContent = message;
        messageBox.style.display = "flex";
        document.getElementById("messageBoxCloseBtn").onclick = () => {
            messageBox.style.display = "none";
            console.log("กล่องข้อความถูกปิด กำลังดำเนินการ callback หากมีอยู่");
            if (callback && typeof callback === 'function') {
                callback(); // Execute callback after message box is hidden
            }
        };
    } else {
        console.error("ไม่พบองค์ประกอบกล่องข้อความ! ใช้การบันทึกลงคอนโซลแทน");
        console.log(`${title}: ${message}`);
        if (callback && typeof callback === 'function') {
            callback();
        }
    }
}

// Get DOM elements for profile modal
const profileModal = document.getElementById("profileModal");
const editProfileBtn = document.getElementById("editProfileBtn");
const closeProfileModalBtn = document.getElementById("closeProfileModalBtn");

// New profile input fields
const profileFullNameInput = document.getElementById("profileFullNameInput");
const profileClassInput = document.getElementById("profileClassInput");
const profileNumberInput = document.getElementById("profileNumberInput"); // For "เลขที่"
const profileStudentIdInput = document.getElementById("profileStudentIdInput");


const saveProfileBtn = document.getElementById("saveProfileBtn");


// Function to open profile modal
function openProfileModal() {
    if (profileModal && profileFullNameInput && profileClassInput && profileNumberInput && profileStudentIdInput && currentUser) {
        // Pre-fill with current data from Firestore profile if available
        const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/profiles`, "userProfile");
        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                profileFullNameInput.value = userData.fullName || "";
                profileClassInput.value = userData.class || "";
                // Ensure number and studentId are displayed correctly, even if they are 0 or null
                profileNumberInput.value = userData.number !== undefined && userData.number !== null ? userData.number : "";
                profileStudentIdInput.value = userData.studentId !== undefined && userData.studentId !== null ? userData.studentId : ""; 
            } else {
                // Fallback to displayName if no full profile exists
                profileFullNameInput.value = currentUser.displayName || "";
                profileClassInput.value = "";
                profileNumberInput.value = ""; // Initialize empty
                profileStudentIdInput.value = ""; // Initialize empty
            }
            profileModal.style.display = "flex";
            console.log("Modal โปรไฟล์ถูกเปิดแล้ว ข้อมูลปัจจุบันถูกกรอกล่วงหน้า");
        }).catch(error => {
            console.error("ข้อผิดพลาดในการดึงข้อมูลโปรไฟล์เพื่อกรอกล่วงหน้า:", error);
            // Fallback to displayName if there's an error fetching
            profileFullNameInput.value = currentUser.displayName || "";
            profileClassInput.value = "";
            profileNumberInput.value = ""; // Initialize empty on error
            profileStudentIdInput.value = ""; // Initialize empty on error
            profileModal.style.display = "flex";
        });
    } else {
        console.error("ไม่สามารถเปิด Modal โปรไฟล์ได้ ไม่พบองค์ประกอบหรือผู้ใช้ปัจจุบัน");
    }
}

// Function to close profile modal
function closeProfileModal() {
    if (profileModal) {
        profileModal.style.setProperty('display', 'none', 'important'); 
        console.log("Modal โปรไฟล์ถูกปิดแล้ว สไตล์การแสดงผลปัจจุบัน:", profileModal.style.display);
    } else {
        console.error("ไม่พบองค์ประกอบ Modal โปรไฟล์สำหรับปิด");
    }
}

// Handle authentication state changes
onAuthStateChanged(auth, async (user) => {
    const userGreeting = document.getElementById("userGreeting");
    if (userGreeting) {
        if (user) {
            currentUser = user; // Set global currentUser
            console.log("onAuthStateChanged: ผู้ใช้เข้าสู่ระบบด้วย UID:", user.uid);
            
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profiles`, "userProfile");
            try {
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    // Prefer fullName from Firestore, fallback to Firebase Auth displayName, then email
                    userGreeting.textContent = `สวัสดี, ${userData.fullName || user.displayName || user.email}!`;
                    console.log("ชื่อผู้ใช้ถูกอัปเดตจาก Firestore:", userGreeting.textContent);
                } else {
                    // Fallback to Firebase Auth displayName or email if Firestore profile not found
                    userGreeting.textContent = `สวัสดี, ${user.displayName || user.email || 'ผู้ใช้'}!`;
                    console.log("ชื่อผู้ใช้ถูกอัปเดตจาก Auth หรือค่าเริ่มต้น:", userGreeting.textContent);

                    // If profile doesn't exist in Firestore, create it with initial display name
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email,
                        fullName: user.displayName || "", // Initial full name from display name
                        class: "",
                        number: null, // Initialize number as null
                        studentId: null, 
                        createdAt: new Date().toISOString()
                    }, { merge: true }); // Use merge to ensure only specified fields are updated/created
                    console.log("โปรไฟล์ผู้ใช้ใหม่ถูกสร้างขึ้นใน Firestore เนื่องจากไม่มีอยู่");
                }
            } catch (firestoreError) {
                console.error("ข้อผิดพลาดในการดึงหรือสร้างโปรไฟล์ผู้ใช้จาก Firestore:", firestoreError.message);
                userGreeting.textContent = `สวัสดี, ${user.displayName || user.email || 'ผู้ใช้'}!`;
            }
        } else {
            console.log("ผู้ใช้ออกจากระบบแล้ว กำลังเปลี่ยนเส้นทางไปยัง index.html...");
            window.location.href = "index.html"; 
        }
    } else {
        console.error("ไม่พบองค์ประกอบทักทายผู้ใช้ (id='userGreeting')");
    }
});

// ฟังก์ชันออกจากระบบ
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            console.log("กำลังพยายามออกจากระบบ...");
            await signOut(auth);
            showMessageBox("ออกจากระบบ", "คุณได้ออกจากระบบเรียบร้อยแล้ว");
        } catch (error) {
            console.error("ข้อผิดพลาดในการออกจากระบบ:", error);
            showMessageBox("ข้อผิดพลาด", "ไม่สามารถออกจากระบบได้: " + error.message);
        }
    });
} else {
    console.error("ไม่พบปุ่มออกจากระบบ (id='logoutBtn')");
}

// Event listener สำหรับปุ่มแก้ไขโปรไฟล์
if (editProfileBtn) {
    editProfileBtn.addEventListener("click", openProfileModal);
} else {
    console.error("ไม่พบปุ่มแก้ไขโปรไฟล์ (id='editProfileBtn')");
}

// Event listener สำหรับปุ่มปิด Modal โปรไฟล์
if (closeProfileModalBtn) {
    closeProfileModalBtn.addEventListener("click", closeProfileModal);
} else {
    console.error("ไม่พบปุ่มปิด Modal โปรไฟล์ (id='closeProfileModalBtn')");
}

// Event listener สำหรับปุ่มบันทึกโปรไฟล์
if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async (event) => { 
        event.stopPropagation(); 
        console.log("ปุ่มบันทึกโปรไฟล์ถูกคลิกแล้ว");
        const newFullName = profileFullNameInput.value.trim();
        const newClass = profileClassInput.value.trim();
        const newNumber = profileNumberInput.value.trim(); // Get as string first
        const newStudentId = profileStudentIdInput.value.trim(); // Get as string first

        if (!newFullName) {
            showMessageBox("ข้อมูลไม่ถูกต้อง", "กรุณากรอกชื่อ-นามสกุล");
            console.warn("ช่องชื่อ-นามสกุลว่างเปล่า");
            return;
        }
        if (newNumber === "" || isNaN(parseInt(newNumber))) { 
            showMessageBox("ข้อมูลไม่ถูกต้อง", "กรุณากรอกเลขที่เป็นตัวเลขที่ถูกต้อง");
            console.warn("เลขที่ว่างเปล่าหรือไม่ใช่ตัวเลขที่ถูกต้อง");
            return;
        }
        if (newStudentId === "" || isNaN(parseInt(newStudentId))) { 
            showMessageBox("ข้อมูลไม่ถูกต้อง", "กรุณากรอกเลขประจำตัวเป็นตัวเลขที่ถูกต้อง");
            console.warn("เลขประจำตัวว่างเปล่าหรือไม่ใช่ตัวเลขที่ถูกต้อง");
            return;
        }


        if (currentUser) {
            console.log("ตรวจพบผู้ใช้ปัจจุบัน กำลังพยายามอัปเดตโปรไฟล์...");
            try {
                // 1. Update display name in Firebase Authentication (optional, but good for consistency)
                await updateProfile(currentUser, { displayName: newFullName });
                console.log("โปรไฟล์ Firebase Auth ถูกอัปเดตด้วยชื่อ-นามสกุลใหม่:", newFullName);

                // 2. Update user profile in Firestore
                const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/profiles`, "userProfile");
                const profileData = { 
                    fullName: newFullName,
                    class: newClass,
                    number: parseInt(newNumber), // Ensure it's a number for Firestore and Apps Script
                    studentId: parseInt(newStudentId), // Ensure it's a number for Firestore and Apps Script
                    lastUpdated: new Date().toISOString()
                };
                await setDoc(userDocRef, profileData, { merge: true }); 
                console.log("โปรไฟล์ผู้ใช้ Firestore ถูกอัปเดต/สร้างด้วยข้อมูลใหม่");

                // 3. ** NEW: Send profile data to Google Apps Script (Single Sheet) **
                if (GOOGLE_APPS_SCRIPT_WEB_APP_URL === 'https://script.google.com/macros/s/AKfycbymhqfn_R_bpWKRL2ClDKZofpLYJ77p-dBPYYFiwxKY5Ga9eMpkdqmOEQSOPEaT-PFV/exec') {
                    try {
                        const dataToSend = {
                            type: 'profile', // Indicate data type
                            data: {
                                uid: currentUser.uid, // Firebase UID (for internal tracking if needed)
                                studentId: profileData.studentId, // 'เลขประจำตัว' for Sheets lookup
                                fullName: profileData.fullName,
                                class: profileData.class,
                                number: profileData.number, // 'เลขที่' for Sheets
                            }
                        };
                        console.log("กำลังส่งข้อมูลโปรไฟล์ไปยัง Google Apps Script (ชีทเดียว):", dataToSend);
                        const response = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
                            method: 'POST',
                            mode: 'cors', // Enable CORS
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(dataToSend)
                        });

                        const result = await response.json();
                        if (result.status === 'success') {
                            console.log("ส่งข้อมูลโปรไฟล์ไป Google Sheet สำเร็จ:", result.message);
                        } else {
                            console.error("ข้อผิดพลาดในการส่งข้อมูลโปรไฟล์ไป Google Sheet:", result.message);
                            // It's possible to have an error here due to Apps Script issues (e.g., CORS from local server)
                            // But Firestore update should still proceed.
                        }
                    } catch (appsScriptError) {
                        console.error("ข้อผิดพลาดในการเชื่อมต่อ Google Apps Script สำหรับโปรไฟล์:", appsScriptError);
                        // Do not block UI/Firestore update due to Sheets sync error.
                        // This is likely the CORS error you are seeing locally.
                    }
                } else {
                    console.warn("ไม่ได้ตั้งค่า GOOGLE_APPS_SCRIPT_WEB_APP_URL หรือยังเป็นค่าเริ่มต้น ไม่สามารถส่งข้อมูลโปรไฟล์ไป Google Sheet ได้");
                }


                // Update the greeting on the page immediately
                document.getElementById("userGreeting").textContent = `สวัสดี, ${newFullName}!`;
                console.log("คำทักทายผู้ใช้บนหน้าถูกอัปเดตแล้ว");

                closeProfileModal(); 
                showMessageBox("บันทึกสำเร็จ", "ข้อมูลโปรไฟล์ของคุณถูกบันทึกเรียบร้อยแล้ว!");
                
            } catch (error) {
                console.error("ข้อผิดพลาดในการอัปเดตโปรไฟล์ใน Firebase Auth หรือ Firestore:", error.message); 
                showMessageBox("ข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้: " + error.message);
                closeProfileModal(); 
            }
        } else {
            showMessageBox("ข้อผิดพลาด", "ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง");
            console.error("ไม่พบผู้ใช้ปัจจุบันขณะพยายามบันทึกโปรไฟล์");
            closeProfileModal(); 
        }
    });
} else {
    console.error("ไม่พบปุ่มบันทึกโปรไฟล์ (id='saveProfileBtn')");
}

// ตัวจัดการการคลิกการ์ดบทเรียน (ตอนนี้มีแค่อนุกรมวิธาน)
document.querySelectorAll(".lesson-card").forEach(card => {
    card.addEventListener("click", () => {
        const lessonId = card.dataset.lesson;
        window.location.href = `lesson_detail.html?id=${lessonId}`;
        console.log(`กำลังเปลี่ยนเส้นทางไปยังบทเรียน: ${lessonId}`);
    });
});
