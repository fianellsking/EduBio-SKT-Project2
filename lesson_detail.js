import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import chat module functions directly
import { initChatModule, setChatContext } from './chat_module.js';

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
const finalFirebaseConfig = (Object.keys(firebaseConfig).length === 0 || !firebaseConfig.projectId) ? tempFirebaseConfig : firebaseConfig;

// Initialize Firebase
const app = initializeApp(finalFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserId = null;
let currentLessonId = null;
// ทำให้ currentLessonData เป็น global เพื่อให้เข้าถึงได้จาก script ด้านนอก (สำหรับ chat_module)
window.currentLessonData = null; 
let preTestScore = 0;
let postTestScore = 0;
let userPreTestAnswers = {}; 
let userPostTestAnswers = {}; // Added to store post-test answers
let currentUserProfile = {}; // Store user profile data for sending to Sheets

// ** NEW: Google Apps Script Web App URL **
// <<--- เปลี่ยน URL นี้ด้วย Web App URL ที่คุณคัดลอกมาจากการ Deploy Google Apps Script
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbymhqfn_R_bpWKRL2ClDKZofpLYJ77p-dBPYYFiwxKY5Ga9eMpkdqmOEQSOPEaT-PFV/exec'; 

// --- Lesson Data (ตัวอย่างข้อมูลบทเรียน) ---
// ทำให้ lessonsData เป็น global เพื่อให้เข้าถึงได้จาก script ด้านนอก (สำหรับ chat_module)
window.lessonsData = {
    "taxonomy": {
        title: "อนุกรมวิธาน",
        preTest: [
            { id: "pre_q1", question: "ข้อใดกล่าวถึงความหมายของ Taxonomy ได้ถูกต้อง", options: ["การสังเคราะห์อาหารของสิ่งมีชีวิต", "การจัดจำแนกและตั้งชื่อสิ่งมีชีวิต", "การศึกษาการถ่ายทอดทางพันธุกรรม", "การสร้างอาหารของพืช"], answer: "การจัดจำแนกและตั้งชื่อสิ่งมีชีวิต", explanation: "Taxonomy (อนุกรมวิธาน) คือ สาขาวิชาที่ศึกษาเกี่ยวกับการจัดหมวดหมู่ การจำแนก และการตั้งชื่อสิ่งมีชีวิต เพื่อให้เป็นระบบและเข้าใจง่าย" },
            { id: "pre_q2", question: "ผู้ที่ได้รับการยกย่องว่าเป็นบิดาแห่ง Taxonomy คือใคร", options: ["ดาร์วิน", "เมนเดล", "ลินเนียส", "วัตสัน"], answer: "ลินเนียส", explanation: "คาร์ล ลินเนียส (Carolus Linnaeus) เป็นนักพฤกษศาสตร์ชาวสวีเดน ผู้คิดค้นระบบการตั้งชื่อวิทยาศาสตร์แบบทวินามและได้รับการยกย่องเป็นบิดาแห่งอนุกรมวิธาน" },
            { id: "pre_q3", question: "ระบบการตั้งชื่อสิ่งมีชีวิตแบบทวินามใช้ภาษาใด", options: ["อังกฤษ", "ละติน", "เยอรมัน", "ฝรั่งเศส"], answer: "ละติน", explanation: "การใช้ภาษาละตินในการตั้งชื่อวิทยาศาสตร์ทำให้ชื่อเป็นสากลและไม่เปลี่ยนแปลงไปตามภาษาท้องถิ่นต่างๆ ทั่วโลก" },
            { id: "pre_q4", question: "ชื่อวิทยาศาสตร์ Homo sapiens คำว่า 'Homo' คืออะไร", options: ["อาณาจักร", "วงศ์", "สกุล", "ชนิด"], answer: "สกุล", explanation: "ในระบบการตั้งชื่อแบบทวินาม คำแรกคือชื่อสกุล (Genus) ซึ่งขึ้นต้นด้วยตัวพิมพ์ใหญ่ ส่วนคำที่สองคือชื่อชนิด (Specific Epithet)" },
            { id: "pre_q5", question: "สิ่งมีชีวิตในอาณาจักร Monera มีลักษณะอย่างไร", options: ["เซลล์เดียว ไม่มีเยื่อหุ้มนิวเคลียส", "เซลล์เดียว มีนิวเคลียสแท้จริง", "หลายเซลล์ มีคลอโรพลาสต์", "หลายเซลล์ ไม่มีผนังเซลล์"], answer: "เซลล์เดียว ไม่มีเยื่อหุ้มนิวเคลียส", explanation: "อาณาจักร Monera (ปัจจุบันแบ่งเป็น Bacteria และ Archaea) ประกอบด้วยสิ่งมีชีวิตเซลล์เดียวที่เป็นโปรคาริโอต (Prokaryote) คือไม่มีเยื่อหุ้มล้อมรอบนิวเคลียสและออร์แกเนลล์ภายในเซลล์" },
            { id: "pre_q6", question: "เห็ด รา และยีสต์ จัดอยู่ในอาณาจักรใด", options: ["Plantae", "Animalia", "Fungi", "Protista"], answer: "Fungi", explanation: "เห็ด รา และยีสต์ จัดอยู่ในอาณาจักร Fungi (ฟังไจ) ซึ่งเป็นกลุ่มสิ่งมีชีวิตที่ไม่มีคลอโรพลาสต์และได้รับสารอาหารจากการย่อยสลายสิ่งมีชีวิตอื่น" },
            { id: "pre_q7", question: "ข้อใดไม่ใช่อาณาจักรในระบบ 5 อาณาจักรของสิ่งมีชีวิต", options: ["Monera", "Protista", "Fungi", "Virus"], answer: "Virus", explanation: "ระบบ 5 อาณาจักร (Five Kingdom Classification) โดย Whittaker ประกอบด้วย Monera, Protista, Fungi, Plantae และ Animalia ส่วนไวรัสไม่ถูกจัดว่าเป็นสิ่งมีชีวิตที่สมบูรณ์จึงไม่ได้อยู่ในระบบอาณาจักร" },
            { id: "pre_q8", question: "สิ่งมีชีวิตที่สามารถสังเคราะห์แสงได้คือกลุ่มใด", options: ["Animalia", "Plantae", "Fungi", "Monera"], answer: "Plantae", explanation: "อาณาจักร Plantae (พืช) ประกอบด้วยสิ่งมีชีวิตที่เป็นผู้ผลิต ซึ่งมีความสามารถในการสังเคราะห์แสงเพื่อสร้างอาหารเองได้" },
            { id: "pre_q9", question: "ข้อใดคือตัวอย่างสิ่งมีชีวิตในอาณาจักร Protista", options: ["อะมีบา", "เห็ด", "แบคทีเรีย", "มอส"], answer: "อะมีบา", explanation: "อาณาจักร Protista (โพรทิสต์) เป็นกลุ่มสิ่งมีชีวิตที่มีความหลากหลายสูง ส่วนใหญ่เป็นเซลล์เดียวและมีนิวเคลียสแท้จริง เช่น อะมีบา พารามีเซียม สาหร่ายบางชนิด" },
            { id: "pre_q10", question: "การจำแนกสิ่งมีชีวิตมีประโยชน์อย่างไร", options: ["เพื่อความสวยงาม", "เพื่อศึกษาความสัมพันธ์ของสิ่งมีชีวิต", "เพื่อสร้างสิ่งมีชีวิตใหม่", "เพื่อเปลี่ยนแปลงรูปร่างสิ่งมีชีวิต"], answer: "เพื่อศึกษาความสัมพันธ์ของสิ่งมีชีวิต", explanation: "การจำแนกสิ่งมีชีวิตช่วยให้นักวิทยาศาสตร์สามารถจัดระบบและทำความเข้าใจความสัมพันธ์ทางวิวัฒนาการและความหลากหลายของสิ่งมีชีวิตบนโลกได้อย่างเป็นระเบียบ" },
            { id: "pre_q11", question: "สัตว์จัดอยู่ในอาณาจักรใด", options: ["Plantae", "Fungi", "Animalia", "Protista"], answer: "Animalia", explanation: "อาณาจักร Animalia (สัตว์) ประกอบด้วยสิ่งมีชีวิตที่เคลื่อนที่ได้และได้รับอาหารจากการบริโภคสิ่งมีชีวิตอื่น" },
            { id: "pre_q12", question: "เซลล์ของแบคทีเรียมีลักษณะอย่างไร", options: ["ไม่มีนิวเคลียสแท้จริง", "มีนิวเคลียสแท้จริง", "ไม่มีผนังเซลล์", "เป็นเซลล์ของพืช"], answer: "ไม่มีนิวเคลียสแท้จริง", explanation: "แบคทีเรียเป็นสิ่งมีชีวิตในกลุ่มโปรคาริโอต ซึ่งเซลล์ของมันไม่มีเยื่อหุ้มนิวเคลียสล้อมรอบสารพันธุกรรม" },
            { id: "pre_q13", question: "ผนังเซลล์ของพืชประกอบด้วยสารใด", options: ["ไคติน", "ไกลโคเจน", "กลูโคส", "เซลลูโลส"], answer: "เซลลูโลส", explanation: "ผนังเซลล์ของพืชสร้างขึ้นจากสารประกอบเชิงซ้อนที่เรียกว่า เซลลูโลส ซึ่งให้ความแข็งแรงและรูปร่างแก่เซลล์พืช" },
            { id: "pre_q14", question: "สิ่งมีชีวิตในอาณาจักร Protista มีลักษณะอย่างไร", options: ["เซลล์เดียวหรือหลายเซลล์ง่ายๆ", "มีเฉพาะเซลล์เดียวเท่านั้น", "มีเฉพาะพืชน้ำ", "มีเฉพาะสัตว์เซลล์เดียว"], answer: "เซลล์เดียวหรือหลายเซลล์ง่ายๆ", explanation: "อาณาจักร Protista มีความหลากหลายสูงมาก ประกอบด้วยสิ่งมีชีวิตทั้งเซลล์เดียวและหลายเซลล์ที่มีโครงสร้างไม่ซับซับซ้อน" },
            { id: "pre_q15", question: "เห็ดจัดอยู่ในอาณาจักรใด", options: ["Plantae", "Protista", "Fungi", "Animalia"], answer: "Fungi", explanation: "เห็ดเป็นสิ่งมีชีวิตในอาณาจักร Fungi ซึ่งแตกต่างจากพืชตรงที่เห็ดไม่สามารถสังเคราะห์แสงได้" },
            { id: "pre_q16", question: "ไวรัสมีลักษณะเด่นข้อใด", options: ["เป็นสิ่งมีชีวิตแท้จริง", "ไม่มีสารพันธุกรรม", "ต้องอาศัยเซลล์สิ่งมีชีวิตอื่นในการเพิ่มจำนวน", "มีเซลล์ที่สมบูรณ์"], answer: "ต้องอาศัยเซลล์สิ่งมีชีวิตอื่นในการเพิ่มจำนวน", explanation: "ไวรัสเป็นปรสิตที่ต้องอาศัยเซลล์ของสิ่งมีชีวิตอื่นเพื่อทำการเพิ่มจำนวน (Replication) และไม่สามารถดำรงชีวิตอยู่ได้ด้วยตัวเองอย่างอิสระ" },
            { id: "pre_q17", question: "ระบบการตั้งชื่อแบบทวินามใช้กี่คำ", options: ["2 คำ", "3 คำ", "4 คำ", "1 คำ"], answer: "2 คำ", explanation: "ระบบทวินาม (Binomial Nomenclature) หมายถึงการใช้ชื่อสองคำเพื่อระบุชื่อวิทยาศาสตร์ของสิ่งมีชีวิต คือ ชื่อสกุล (Genus) และชื่อชนิด (Specific Epithet)" },
            { id: "pre_q18", question: "แบคทีเรียจัดเป็นสิ่งมีชีวิตกลุ่มใด", options: ["Eukaryote", "Protista", "Monera", "Animalia"], answer: "Monera", explanation: "แบคทีเรียเป็นสมาชิกหลักของอาณาจักร Monera ซึ่งเป็นกลุ่มของสิ่งมีชีวิตเซลล์เดียวแบบโปรคาริโอต" },
            { id: "pre_q19", question: "ข้อใดต่อไปนี้ไม่มีคลอโรพลาสต์", options: ["สาหร่ายสีเขียว", "เฟิร์น", "เห็ด", "มอส"], answer: "เห็ด", explanation: "คลอโรพลาสต์เป็นออร์แกเนลล์ที่พบในพืชและสาหร่าย ทำหน้าที่สังเคราะห์แสง แต่เห็ดอยู่ในอาณาจักร Fungi ซึ่งไม่มีคลอโรพลาสต์และไม่สามารถสังเคราะห์แสงได้" },
            { id: "pre_q20", question: "ดอกไม้จัดอยู่ในอาณาจักรใด", options: ["Plantae", "Protista", "Fungi", "Animalia"], answer: "Plantae", explanation: "ดอกไม้เป็นส่วนหนึ่งของพืช จัดอยู่ในอาณาจักร Plantae ซึ่งเป็นกลุ่มสิ่งมีชีวิตที่ส่วนใหญ่เป็นผู้ผลิตโดยการสังเคราะห์แสง" }
        ],
        content: {
            introductionText: `
                <p>หลังจากทำแบบทดสอบก่อนเรียนแล้ว เรามาลองศึกษาการจำแนกสิ่งมีชีวิตกันและอาณาจักรของสิ่งมีชีวิตทั้ง5กัน!</p>
                <p></p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">วิดีโอภาพรวมการจำแนกสิ่งมีชีวิต</h3>
            `,
            // เพิ่มลิงก์วิดีโอภาพรวมการจำแนกสิ่งมีชีวิตที่นี่
            generalVideoUrls: [
                "https://www.youtube.com/embed/sxhRXMi5cI4",
                "https://www.youtube.com/embed/Jje9_PmlcgU"
            ],
            kingdoms: {
                "monera": {
                    name: "อาณาจักร Monera (แบคทีเรีย, อาร์เคีย)",
                    icon: "🦠", // Emoji for microorganisms
                    text: `
                        <p><strong>อาณาจักร Monera</strong> ประกอบด้วยสิ่งมีชีวิตเซลล์เดียวขนาดเล็กมากที่เรียกว่า <strong>โปรคาริโอต (Prokaryotes)</strong> ซึ่งแตกต่างจากเซลล์ยูคาริโอตที่เราพบในพืช สัตว์ เห็ดรา และโพรทิสต์อย่างสิ้นเชิง</p>
                        <h4 class="text-lg font-semibold mt-3 mb-2 text-gray-600">ลักษณะสำคัญ:</h4>
                        <ul class="list-disc list-inside ml-4">
                            <li>**ไม่มีเยื่อหุ้มนิวเคลียส:** สารพันธุกรรม (DNA) จะลอยอยู่เป็นอิสระในไซโทพลาสซึม ไม่ได้ถูกบรรจุอยู่ในนิวเคลียสที่ชัดเจน</li>
                            <li>**ไม่มีออร์แกเนลล์ที่มีเยื่อหุ้ม:** เช่น ไมโทคอนเดรีย, คลอโรพลาสต์, ร่างแหเอนโดพลาซึม แต่มีไรโบโซมสำหรับการสังเคราะห์โปรตีน</li>
                            <li>**ผนังเซลล์:** ส่วนใหญ่มีผนังเซลล์ที่ทำจากเพปทิโดไกลแคน (Peptidoglycan) ซึ่งให้ความแข็งแรง</li>
                            <li>**การดำรงชีวิต:** มีทั้งที่สร้างอาหารเองได้ (สังเคราะห์แสงหรือสังเคราะห์เคมี) และที่ดำรงชีวิตแบบผู้ย่อยสลายหรือปรสิต</li>
                        </ul>
                        <p class="mt-4">ตัวอย่าง: แบคทีเรีย (Bacteria) เช่น E. coli, แบคทีเรียในโยเกิร์ต, ไซยาโนแบคทีเรีย (Cyanobacteria) และอาร์เคีย (Archaea)</p>
                    `,
                    videoUrl: "https://www.youtube.com/embed/eZTS7Qx8-lw" // Updated video
                    // slideUrl: "..."
                },
                "protista": {
                    name: "อาณาจักร Protista (โพรทิสต์)",
                    icon: "💧", // Emoji for aquatic/single-celled life
                    text: `
                        <p><strong>อาณาจักร Protista</strong> เป็นอาณาจักรที่มีความหลากหลายสูงมาก ประกอบด้วยสิ่งมีชีวิต **ยูคาริโอต (Eukaryotes)** ที่ส่วนใหญ่เป็นเซลล์เดียวหรือมีหลายเซลล์แต่โครงสร้างไม่ซับซ้อน ไม่จัดเป็นพืช สัตว์ หรือเห็ดราอย่างชัดเจน</p>
                        <h4 class="text-lg font-semibold mt-3 mb-2 text-gray-600">ลักษณะสำคัญ:</h4>
                        <ul class="list-disc list-inside ml-4">
                            <li>**เซลล์ยูคาริโอต:** มีเยื่อหุ้มนิวเคลียสและออร์แกเนลล์ที่มีเยื่อหุ้ม</li>
                            <li>**หลากหลายรูปแบบ:** มีทั้งคล้ายพืช (สาหร่าย), คล้ายสัตว์ (โปรโตซัว) และคล้ายเห็ดรา (ราเมือก)</li>
                            <li>**การเคลื่อนที่:** บางชนิดเคลื่อนที่ด้วยแฟลเจลลา (Flagella), ซิเลีย (Cilia) หรือเท้าเทียม (Pseudopods)</li>
                            <li>**การดำรงชีวิต:** มีทั้งผู้ผลิต (สังเคราะห์แสง), ผู้บริโภค และผู้ย่อยสลาย</li>
                        </ul>
                        <p class="mt-4">ตัวอย่าง: อะมีบา, พารามีเซียม, ยูกลีนา, สาหร่ายสีเขียวแกมน้ำเงิน (บางชนิด), ราเมือก</p>
                    `,
                    videoUrl: "https://www.youtube.com/embed/FLjeq1JpRMQ" // Updated video
                    // slideUrl: "..."
                },
                "fungi": {
                    name: "อาณาจักร Fungi (เห็ด รา ยีสต์)",
                    icon: "🍄", // Mushroom emoji
                    text: `
                        <p><strong>อาณาจักร Fungi (ฟังไจ)</strong> ประกอบด้วยสิ่งมีชีวิตกลุ่มเห็ด รา และยีสต์ ซึ่งเป็นสิ่งมีชีวิต **ยูคาริโอต** ที่มีลักษณะเฉพาะตัว</p>
                        <h4 class="text-lg font-semibold mt-3 mb-2 text-gray-600">ลักษณะสำคัญ:</h4>
                        <ul class="list-disc list-inside ml-4">
                            <li>**ไม่สังเคราะห์แสง:** ไม่มีคลอโรพลาสต์ จึงไม่สามารถสร้างอาหารเองได้</li>
                            <li>**การดูดซึมสารอาหาร:** ได้รับสารอาหารโดยการหลั่งเอนไซม์ออกมาย่อยสลายสารอินทรีย์ภายนอกเซลล์ แล้วดูดซึมสารอาหารที่ย่อยแล้วเข้าไป</li>
                            <li>**ผนังเซลล์:** ทำจากสารไคติน (Chitin) ซึ่งแตกต่างจากผนังเซลล์พืชที่ทำจากเซลลูโลส</li>
                            <li>**โครงสร้าง:** ส่วนใหญ่มีโครงสร้างเป็นเส้นใยเรียกว่า ไฮฟา (Hyphae) รวมกลุ่มเป็นไมซีเลียม (Mycelium) ส่วนยีสต์เป็นเซลล์เดียว</li>
                        </ul>
                        <p class="mt-4">ตัวอย่าง: เห็ดฟาง, ราขนมปัง, ยีสต์</p>
                    `,
                    videoUrl: "https://www.youtube.com/embed/9J26ghiAVRs" // Updated video
                    // slideUrl: "..."
                },
                "plantae": {
                    name: "อาณาจักร Plantae (พืช)",
                    icon: "🌳", // Tree emoji
                    text: `
                        <p><strong>อาณาจักร Plantae (พืช)</strong> ประกอบด้วยสิ่งมีชีวิต **ยูคาริโอต** ที่มีความสามารถในการสร้างอาหารเองด้วยกระบวนการสังเคราะห์แสง</p>
                        <h4 class="text-lg font-semibold mt-3 mb-2 text-gray-600">ลักษณะสำคัญ:</h4>
                        <ul class="list-disc list-inside ml-4">
                            <li>**สังเคราะห์แสง:** มีคลอโรพลาสต์ภายในเซลล์ ซึ่งมีคลอโรฟิลล์สำหรับจับแสงและเปลี่ยนพลังงานแสงเป็นพลังงานเคมี</li>
                            <li>**ผนังเซลล์:** ทำจากเซลลูโลส (Cellulose) ซึ่งให้ความแข็งแรงและโครงสร้างที่แน่นอน</li>
                            <li>**ผู้ผลิต:** เป็นสิ่งมีชีวิตที่สำคัญที่สุดในระบบนิเวศ เนื่องจากเป็นผู้ผลิตอาหารและออกซิเจน</li>
                            <li>**การดำรงชีวิต:** ส่วนใหญ่ดำรงชีวิตอยู่กับที่ ไม่เคลื่อนที่อิสระเหมือนสัตว์</li>
                        </ul>
                        <p class="mt-4">ตัวอย่าง: มอส, เฟิร์น, สน, พืชดอก, พืชใบเลี้ยงเดี่ยว, พืชใบเลี้ยงคู่</p>
                    `,
                    videoUrl: "https://www.youtube.com/embed/XccrbDIelic" // Updated video
                    // slideUrl: "..."
                },
                "animalia": {
                    name: "อาณาจักร Animalia (สัตว์)",
                    icon: "🐾", // Paw prints emoji
                    text: `
                        <p><strong>อาณาจักร Animalia (สัตว์)</strong> ประกอบด้วยสิ่งมีชีวิต **ยูคาริโอต** ที่มีความหลากหลายสูงและมีลักษณะเฉพาะตัว</p>
                        <h4 class="text-lg font-semibold mt-3 mb-2 text-gray-600">ลักษณะสำคัญ:</h4>
                        <ul class="list-disc list-inside ml-4">
                            <li>**ผู้บริโภค:** ไม่สามารถสร้างอาหารเองได้ ต้องได้รับสารอาหารจากการกินสิ่งมีชีวิตอื่น</li>
                            <li>**ไม่มีผนังเซลล์:** เซลล์สัตว์ไม่มีผนังเซลล์ ทำให้เซลล์มีความยืดหยุ่นและสามารถเปลี่ยนแปลงรูปร่างได้</li>
                            <li>**เคลื่อนที่ได้:** ส่วนใหญ่สามารถเคลื่อนที่ได้อิสระเพื่อหาอาหาร หลบหนีศัตรู หรือหาคู่</li>
                            <li>**ระบบประสาทและกล้ามเนื้อ:** มีการพัฒนาระบบประสาทและกล้ามเนื้อเพื่อการตอบสนองต่อสิ่งเร้าและการเคลื่อนไหว</li>
                        </ul>
                        <p class="mt-4">ตัวอย่าง: ฟองน้ำ, หนอนตัวแบน, แมลง, ปลา, สัตว์เลื้อยคลาน, นก, สัตว์เลี้ยงลูกด้วยนม (รวมถึงมนุษย์)</p>
                    `,
                    videoUrl: "https://www.youtube.com/embed/fweFvmVrVk0" // Updated video
                    // slideUrl: "..."
                }
            }
        },
        postTest: [
            { id: "post_q1", question: "สิ่งมีชีวิตในข้อใดจัดอยู่ในอาณาจักร Protista ทั้งหมด", options: ["อะมีบา พลาสโมเดียม ยูกลีนา", "เห็ด รา ยีสต์", "มอส เฟิร์น หญ้า", "ไวรัส แบคทีเรีย อะมีบา"], answer: "อะมีบา พลาสโมเดียม ยูกลีนา", explanation: "สิ่งมีชีวิตอย่าง อะมีบา พลาสโมเดียม และยูกลีนา จัดอยู่ในอาณาจักร Protista ซึ่งเป็นสิ่งมีชีวิตเซลล์เดียวหรือหลายเซลล์ง่ายๆ ที่มีนิวเคลียสแท้จริง" },
            { id: "post_q2", question: "ข้อใดแสดงลำดับการจัดจำแนกสิ่งมีชีวิตจากกว้างไปแคบถูกต้อง", options: ["ชนิด → อาณาจักร → สกุล → วงศ์", "อาณาจักร → สกุล → วงศ์ → ชนิด", "อาณาจักร → ไฟลัม → วงศ์ → สกุล → ชนิด", "อาณาจักร → วงศ์ → ไฟลัม → สกุล → ชนิด"], answer: "อาณาจักร → ไฟลัม → วงศ์ → สกุล → ชนิด", explanation: "ลำดับการจัดจำแนกสิ่งมีชีวิตจากกว้างไปแคบที่ถูกต้องคือ อาณาจักร (Kingdom) > ไฟลัม (Phylum) > อันดับ (Order) > วงศ์ (Family) > สกุล (Genus) > ชนิด (Species)" },
            { id: "post_q3", question: "ข้อใดกล่าวถึงลักษณะของสิ่งมีชีวิตกลุ่มโปรคาริโอตได้ถูกต้อง", options: ["มีเยื่อหุ้มนิวเคลียส", "มีนิวเคลียสแท้จริง", "ไม่มีเยื่อหุ้มนิวเคลียส", "มีออร์แกเนลล์ครบถ้วน"], answer: "ไม่มีเยื่อหุ้มนิวเคลียส", explanation: "โปรคาริโอต (Prokaryote) เป็นสิ่งมีชีวิตที่เซลล์ไม่มีเยื่อหุ้มล้อมรอบนิวเคลียสและออร์แกเนลล์ภายในเซลล์ เช่น แบคทีเรีย" },
            { id: "post_q4", question: "ข้อใดเป็นอาณาจักรของสิ่งมีชีวิตยูคาริโอตทั้งหมด", options: ["Monera, Protista, Fungi", "Protista, Fungi, Plantae, Animalia", "Monera, Plantae, Animalia", "Protista, Fungi, Monera"], answer: "Protista, Fungi, Plantae, Animalia", explanation: "สิ่งมีชีวิตยูคาริโอต (Eukaryote) คือสิ่งมีชีวิตที่เซลล์มีเยื่อหุ้มล้อมรอบนิวเคลียสและออร์แกเนลล์ภายในเซลล์ ได้แก่ อาณาจักร Protista, Fungi, Plantae และ Animalia" },
            { id: "post_q5", question: "ข้อใดไม่ใช่เกณฑ์หลักในการจำแนกอาณาจักรสิ่งมีชีวิต", options: ["โครงสร้างเซลล์", "วิธีการสืบพันธุ์", "วิธีการดำรงชีวิต", "สีของสิ่งมีชีวิต"], answer: "สีของสิ่งมีชีวิต", explanation: "เกณฑ์หลักในการจำแนกอาณาจักรสิ่งมีชีวิตจะพิจารณาจากโครงสร้างเซลล์ (โปรคาริโอต/ยูคาริโอต), จำนวนเซลล์ (เซลล์เดียว/หลายเซลล์), ผนังเซลล์, และวิธีการดำรงชีวิต (ผู้ผลิต/ผู้บริโภค/ผู้ย่อยสลาย) สีของสิ่งมีชีวิตไม่ใช่เกณฑ์หลัก" },
            { id: "post_q6", question: "ข้อใดต่อไปนี้ไม่ถือว่าเป็นสิ่งมีชีวิต", options: ["แบคทีเรีย", "รา", "ไวรัส", "สาหร่ายสีเขียว"], answer: "ไวรัส", explanation: "ไวรัสอยู่ก้ำกึ่งระหว่างสิ่งมีชีวิตและไม่มีชีวิต เนื่องจากไม่สามารถดำรงชีวิตหรือเพิ่มจำนวนได้ด้วยตัวเอง ต้องอาศัยเซลล์สิ่งมีชีวิตอื่นในการเพิ่มจำนวนเท่านั้น" },
            { id: "post_q7", question: "สาหร่ายสีเขียวบางชนิดจัดอยู่ในอาณาจักรใด", options: ["Animalia", "Fungi", "Plantae หรือ Protista", "Monera"], answer: "Plantae หรือ Protista", explanation: "สาหร่ายสีเขียวบางชนิดจัดอยู่ในอาณาจักร Protista (เช่น สาหร่ายเซลล์เดียว) และบางชนิดจัดอยู่ในอาณาจักร Plantae (เช่น สาหร่ายหลายเซลล์ขนาดใหญ่ที่โครงสร้างซับซ้อน)" },
            { id: "post_q8", question: "ข้อใดกล่าวถึงแบคทีเรียถูกต้อง", options: ["เป็นสิ่งมีชีวิตหลายเซลล์", "มีเฉพาะชนิดที่ก่อโรค", "มีทั้งที่ก่อโรคและไม่ก่อโรค", "มีนิวเคลียสแท้จริง"], answer: "มีทั้งที่ก่อโรคและไม่ก่อโรค", explanation: "แบคทีเรียเป็นสิ่งมีชีวิตที่มีความหลากหลายสูงมาก มีทั้งชนิดที่เป็นประโยชน์ต่อสิ่งแวดล้อมและสิ่งมีชีวิตอื่น (เช่น แบคทีเรียในลำไส้) และชนิดที่ก่อให้เกิดโรค" },
            { id: "post_q9", question: "ข้อใดเป็นลักษณะของเห็ดและรา", options: ["สังเคราะห์แสงได้", "ไม่มีผนังเซลล์", "ไม่มีคลอโรพลาสต์และดูดซึมอาหารจากสิ่งมีชีวิตอื่น", "เป็นสิ่งมีชีวิตเซลล์เดียวเท่านั้น"], answer: "ไม่มีคลอโรพลาสต์และดูดซึมอาหารจากสิ่งมีชีวิตอื่น", explanation: "เห็ดและรา (อาณาจักร Fungi) ไม่มีคลอโรพลาสต์จึงไม่สามารถสังเคราะห์แสงได้ พวกมันได้รับสารอาหารโดยการหลั่งเอนไซม์ออกมาย่อยสลายสารอินทรีย์ภายนอกเซลล์แล้วดูดซึมเข้าสู่เซลล์" },
            { id: "post_q10", question: "สัตว์เซลล์เดียวจัดอยู่ในอาณาจักรใด", options: ["Fungi", "Animalia", "Monera", "Protista"], answer: "Protista", explanation: "สิ่งมีชีวิตเซลล์เดียวที่มีลักษณะคล้ายสัตว์ เช่น อะมีบา พารามีเซียม จัดอยู่ในอาณาจักร Protista (โพรทิสต์)" },
            { id: "post_q11", question: "ยูกลีนามีลักษณะพิเศษข้อใด", options: ["สังเคราะห์แสงไม่ได้", "เป็นได้ทั้งพืชและสัตว์", "เป็นสิ่งมีชีวิตเซลล์เดียวไม่มีนิวเคลียส", "ไม่มีคลอโรพลาสต์"], answer: "เป็นได้ทั้งพืชและสัตว์", explanation: "ยูกลีนา (Euglena) เป็นโปรติสต์ที่มีคลอโรพลาสต์จึงสามารถสังเคราะห์แสงได้เหมือนพืช แต่ก็สามารถเคลื่อนที่ได้และกินอาหารเหมือนสัตว์ จึงถูกเรียกว่าเป็นสิ่งมีชีวิตที่มีลักษณะก้ำกึ่งทั้งพืชและสัตว์" },
            { id: "post_q12", question: "ใครเป็นผู้ตั้งระบบการตั้งชื่อสิ่งมีชีวิตแบบทวินาม", options: ["ดาร์วิน", "เมนเดล", "ลินเนียส", "อริสโตเติล"], answer: "ลินเนียส", explanation: "คาร์ล ลินเนียส (Carolus Linnaeus) เป็นนักวิทยาศาสตร์ชาวสวีเดนผู้คิดค้นและนำเสนอระบบการตั้งชื่อสิ่งมีชีวิตแบบทวินาม (Binomial Nomenclature)" },
            { id: "post_q13", question: "คำว่า 'วงศ์ (Family)' อยู่ในลำดับใดของการจำแนกสิ่งมีชีวิต", options: ["หลังชนิด", "ก่อนอาณาจักร", "หลังอันดับ (Order)", "หลังไฟลัม (Phylum)"], answer: "หลังอันดับ (Order)", explanation: "ลำดับการจัดจำแนกสิ่งมีชีวิตจากกว้างไปแคบคือ อาณาจักร (Kingdom) > ไฟลัม (Phylum) > ชั้น (Class) > อันดับ (Order) > วงศ์ (Family) > สกุล (Genus) > ชนิด (Species)" },
            { id: "post_q14", question: "ไวรัสมีสารพันธุกรรมชนิดใด", options: ["มีเฉพาะ DNA", "มีเฉพาะ RNA", "ไม่มีสารพันธุกรรม", "มีทั้ง DNA หรือ RNA แล้วแต่ชนิดของไวรัส"], answer: "มีทั้ง DNA หรือ RNA แล้วแต่ชนิดของไวรัส", explanation: "ไวรัสเป็นสิ่งมีชีวิตที่มีสารพันธุกรรมเป็นได้ทั้ง DNA หรือ RNA แต่ไวรัสแต่ละชนิดจะมีเพียงสารพันธุกรรมชนิดใดชนิดหนึ่งเท่านั้น ไม่ใช่ทั้งสองชนิดพร้อมกัน" },
            { id: "post_q15", question: "ข้อใดเป็นสิ่งมีชีวิตในอาณาจักร Plantae ทั้งหมด", options: ["สาหร่ายสีแดง สาหร่ายน้ำตาล เห็ด", "มอส เฟิร์น พืชดอก", "รา เห็ด ยีสต์", "ยูกลีนา อะมีบา พลาสโมเดียม"], answer: "มอส เฟิร์น พืชดอก", explanation: "มอส เฟิร์น และพืชดอกเป็นตัวอย่างของสิ่งมีชีวิตที่จัดอยู่ในอาณาจักร Plantae (พืช) ซึ่งมีลักษณะเด่นคือสามารถสังเคราะห์แสงได้" },
            { id: "post_q16", question: "ข้อใดกล่าวถึงโปรคาริโอตได้ถูกต้อง", options: ["ไม่มีผนังเซลล์", "มีออร์แกเนลล์ครบถ้วน", "ไม่มีเยื่อหุ้มนิวเคลียส", "มีนิวเคลียสแท้จริง"], answer: "ไม่มีเยื่อหุ้มนิวเคลียส", explanation: "โปรคาริโอต (Prokaryote) คือสิ่งมีชีวิตที่เซลล์ไม่มีเยื่อหุ้มล้อมรอบนิวเคลียสและออร์แกเนลล์ภายในเซลล์ ทำให้สารพันธุกรรมกระจายอยู่ในไซโทพลาซึม" },
            { id: "post_q17", question: "ผนังเซลล์ของพืชประกอบด้วยอะไร", options: ["เซลลูโลส", "ไกลโคเจน", "ไคติน", "โปรตีน"], answer: "เซลลูโลส", explanation: "ผนังเซลล์ของพืชสร้างขึ้นจากสารประกอบคาร์โบไฮเดรตเชิงซ้อนที่เรียกว่า เซลลูโลส (Cellulose) ซึ่งเป็นโครงสร้างที่ให้ความแข็งแรงและช่วยรักษารูปร่างของเซลล์" },
            { id: "post_q18", question: "ข้อใดต่อไปนี้ไม่มีผนังเซลล์", options: ["พืช", "เห็ด", "แบคทีเรีย", "สัตว์"], answer: "สัตว์", explanation: "เซลล์สัตว์แตกต่างจากเซลล์พืช เห็ดรา และแบคทีเรียตรงที่ไม่มีผนังเซลล์ ทำให้เซลล์สัตว์มีความยืดหยุ่นและสามารถเปลี่ยนแปลงรูปร่างได้" },
            { id: "post_q19", question: "ข้อใดกล่าวถึงแบคทีเรียบางชนิดถูกต้อง", options: ["สังเคราะห์แสงไม่ได้", "บางชนิดสังเคราะห์แสงได้", "ทุกชนิดก่อโรค", "ทุกชนิดมีนิวเคลียสแท้จริง"], answer: "บางชนิดสังเคราะห์แสงได้", explanation: "แบคทีเรียมีความหลากหลายมาก บางชนิดมีรงควัตถุคล้ายคลอโรฟิลล์ที่ช่วยให้สามารถสังเคราะห์แสงได้ เช่น ไซยาโนแบคทีเรีย (Cyanobacteria)" },
            { id: "post_q20", question: "สิ่งมีชีวิตเซลล์เดียวมีได้ทั้งแบบใด", options: ["เฉพาะยูคาริโอต", "เฉพาะโปรคาริโอต", "ทั้งโปรคาริโอตและยูคาริโอต", "ไม่มีเซลล์เดียวในธรรมชาติ"], answer: "ทั้งโปรคาริโอตและยูคาริโอต", explanation: "สิ่งมีชีวิตเซลล์เดียวมีทั้งแบบโปรคาริโอต (Prokaryote) เช่น แบคทีเรีย และแบบยูคาริโอต (Eukaryote) เช่น อะมีบาและยีสต์" }
        ]
    },
    "endocrine-system": {
        title: "ระบบต่อมไร้ท่อ",
        preTest: [
            { id: "pre_e1", question: "ฮอร์โมนที่ควบคุมระดับน้ำตาลในเลือดคือข้อใด?", options: ["อะดรีนาลีน", "ไทรอยด์ฮอร์โมน", "อินซูลิน", "โกรทฮอร์โมน"], answer: "อินซูลิน", explanation: "อินซูลินเป็นฮอร์โมนที่สำคัญในการลดระดับน้ำตาลในเลือด" }
        ],
        content: {
            text: `
                <p><strong>ระบบต่อมไร้ท่อ (Endocrine System)</strong> คือ ระบบที่ควบคุมการทำงานของร่างกายผ่านการหลั่งสารเคมีที่เรียกว่า <strong>ฮอร์โมน (Hormone)</strong> ฮอร์โมนจะถูกผลิตจากต่อมไร้ท่อ (Endocrine Glands) และถูกส่งผ่านกระแสเลือดไปยังอวัยวะเป้าหมายทั่วร่างกาย</p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">ต่อมไร้ท่อที่สำคัญ</h3>
                <ul class="list-disc list-inside ml-4">
                    <li><strong>ต่อมใต้สมอง (Pituitary Gland):</strong> ถือเป็นต่อมหลักที่ควบคุมการทำงานของต่อมไร้ท่ออื่นๆ</li>
                    <li><strong>ต่อมไทรอยด์ (Thyroid Gland):):</strong> ผลิตไทรอยด์ฮอร์โมนควบคุมเมตาบอลิซึม</li>
                    <li><strong>ต่อมหมวกไต (Adrenal Gland):</strong> ผลิตอะดรีนาลีน (Adrenaline) และคอร์ติซอล (Cortisol)</li>
                    <li><strong>ตับอ่อน (Pancreas):):</strong> ผลิตอินซูลิน (Insulin) และกลูคากอน (Glucagon) ควบคุมระดับน้ำตาลในเลือด</li>
                    <li><strong>รังไข่ (Ovaries) / อัณฑะ (Testes):):</strong> ผลิตฮอร์โมนเพศ</li>
                </ul>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">บทบาทของฮอร์โมน</h3>
                <p>ฮอร์โมนมีบทบาทสำคัญในกระบวนการต่างๆ ของร่างกาย เช่น การเจริญเติบโต, เมตาบอลิซึม, การสืบพันธุ์, และการตอบสนองต่อความเครียด</p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">วิดีโอประกอบการเรียนรู้</h3>
            `,
            videoUrl: "https://www.youtube.com/embed/tM6LzP6e9zE"
        },
        postTest: [
            { id: "post_e1", question: "ต่อมไร้ท่อใดที่ถูกเรียกว่า 'Master Gland' เพราะควบคุมการทำงานของต่อมอื่นๆ?", options: ["ต่อมไทรอยด์", "ต่อมใต้สมอง", "ต่อมหมวกไต", "ตับอ่อน"], answer: "ต่อมใต้สมอง", explanation: "ต่อมใต้สมอง หรือ Pituitary Gland มักถูกเรียกว่า Master Gland เนื่องจากเป็นต่อมที่ควบคุมการหลั่งฮอร์โมนของต่อมอื่นๆ" }
        ]
    },
    "genetics": {
        title: "พันธุศาสตร์",
        preTest: [
            { id: "pre_g1", question: "อะไรคือหน่วยพันธุกรรมพื้นฐานที่กำหนดลักษณะของสิ่งมีชีวิต?", options: ["เซลล์", "ยีน", "โปรตีน", "ไขมัน"], answer: "ยีน", explanation: "ยีนเป็นหน่วยพันธุกรรมที่อยู่บน DNA และเป็นตัวกำหนดลักษณะทางพันธุกรรม" }
        ],
        content: {
            text: `
                <p><strong>พันธุศาสตร์ (Genetics)</strong> คือ การศึกษาเกี่ยวกับพันธุกรรม, ความแปรผันของสิ่งมีชีวิต, และการถ่ายทอดลักษณะทางพันธุกรรมจากรุ่นสู่รุ่น</p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">DNA และยีน</h3>
                <ul class="list-disc list-inside ml-4">
                    <li><strong>DNA (Deoxyribonucleic Acid):</strong> เป็นสารพันธุกรรมที่เก็บข้อมูลทางพันธุกรรมของสิ่งมีชีวิต มีโครงสร้างเป็นเกลียวคู่ (Double Helix)</li>
                    <li><strong>ยีน (Gene):):</strong> คือส่วนหนึ่งของ DNA ที่ทำหน้าที่กำหนดลักษณะทางพันธุกรรมต่างๆ เช่น สีตา, หมู่เลือด</li>
                </ul>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">การถ่ายทอดลักษณะทางพันธุกรรม</h3>
                <p>ลักษณะทางพันธุกรรมจะถูกถ่ายทอดผ่านการรวมตัวของยีนจากพ่อและแม่ การแสดงออกของยีนสามารถเป็นแบบเด่น (Dominant) หรือด้อย (Recessive) ได้</p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">วิดีโอประกอบการเรียนรู้</h3>
            `,
            videoUrl: "https://www.youtube.com/embed/zwibgN11_t8"
        },
        postTest: [
            { id: "post_g1", question: "ใครคือผู้คิดค้นกฎการถ่ายทอดลักษณะทางพันธุกรรมที่สำคัญ?", options: ["ชาร์ลส์ ดาร์วิน", "เกรกอร์ เมนเดล", "หลุยส์ ปาสเตอร์", "เจมส์ วัตสัน"], answer: "เกรกอร์ เมนเดล", explanation: "เกรกอร์ เมนเดล เป็นผู้คิดค้นกฎการถ่ายทอดลักษณะทางพันธุกรรมจากการศึกษาในถั่วลันเตา" }
        ]
    },
    "ecology": {
        title: "นิเวศวิทยา",
        preTest: [
            { id: "pre_eco1", question: "ข้อใดไม่ใช่องค์ประกอบทางชีวภาพของระบบนิเวศ?", options: ["ผู้ผลิต", "ผู้บริโภค", "ผู้ย่อยสลาย", "แสงอาทิตย์"], answer: "แสงอาทิตย์", explanation: "แสงอาทิตย์เป็นองค์ประกอบทางกายภาพ (สิ่งไม่มีชีวิต)" }
        ],
        content: {
            text: `
                <p><strong>นิเวศวิทยา (Ecology)</strong> คือ การศึกษาความสัมพันธ์ระหว่างสิ่งมีชีวิตกับสิ่งแวดล้อม ทั้งสิ่งมีชีวิตด้วยกันเองและสิ่งไม่มีชีวิต</p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">องค์ประกอบของระบบนิเวศ</h3>
                <ul class="list-disc list-inside ml-4">
                    <li><strong>องค์ประกอบทางชีวภาพ (Biotic Components):</strong> สิ่งมีชีวิตทั้งหมด เช่น ผู้ผลิต (พืช), ผู้บริโภค (สัตว์), ผู้ย่อยสลาย (แบคทีเรีย, เห็ดรา)</li>
                    <li><strong>องค์ประกอบทางกายภาพ (Abiotic Components):</strong> สิ่งไม่มีชีวิต เช่น แสง, น้ำ, อุณหภูมิ, ดิน, อากาศ</li>
                </ul>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">ความสัมพันธ์ในระบบนิเวศ</h3>
                <ul class="list-disc list-inside ml-4">
                    <li><strong>ห่วงโซ่อาหาร (Food Chain):):</strong> การถ่ายทอดพลังงานจากผู้ผลิตไปยังผู้บริโภคลำดับต่างๆ</li>
                    <li><strong>ใยอาหาร (Food Web):หรือเครือข่ายอาหาร:</strong> ความสัมพันธ์ที่ซับซ้อนของห่วงโซ่อาหารหลายๆ ห่วงโซ่</li>
                </ul>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">วิดีโอประกอบการเรียนรู้</h3>
            `,
            videoUrl: "https://www.youtube.com/embed/dBJtFhC7hX0"
        },
        postTest: [
            { id: "post_eco1", question: "สิ่งมีชีวิตใดที่ทำหน้าที่เป็น 'ผู้ผลิต' ในระบบนิเวศ?", options: ["สัตว์กินพืช", "สัตว์กินเนื้อ", "พืช", "เชื้อรา"], answer: "พืช", explanation: "พืชเป็นผู้ผลิตเนื่องจากสามารถสังเคราะห์แสงสร้างอาหารเองได้" }
        ]
    },
    "cell-biology": {
        title: "ชีววิทยาของเซลล์",
        preTest: [
            { id: "pre_c1", question: "อะไรคือหน่วยพื้นฐานที่เล็กที่สุดของสิ่งมีชีวิต?", options: ["โมเลกุล", "เซลล์", "อวัยวะ", "เนื้อเยื่อ"], answer: "เซลล์", explanation: "เซลล์เป็นหน่วยโครงสร้างและหน้าที่ที่เล็กที่สุดของสิ่งมีชีวิต" }
        ],
        content: {
            text: `
                <p><strong>ชีววิทยาของเซลล์ (Cell Biology)</strong> คือ การศึกษาโครงสร้าง, การทำงาน, และพฤติกรรมของเซลล์</p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">ประเภทของเซลล์</h3>
                <ul class="list-disc list-inside ml-4">
                    <li><strong>เซลล์โปรคาริโอต (Prokaryotic Cells):</strong> ไม่มีเยื่อหุ้มนิวเคลียสและออร์แกเนลล์ที่มีเยื่อหุ้ม พบในแบคทีเรีย, อาร์เคีย</li>
                    <li><strong>เซลล์ยูคาริโอต (Eukaryotic Cells):</strong> มีเยื่อหุ้มนิวเคลียสและออร์แกเนลล์ที่มีเยื่อหุ้ม พบในพืช, สัตว์, เห็ดรา, โพรติสต์</li>
                </ul>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">ออร์แกเนลล์ที่สำคัญ</h3>
                <ul class="list-disc list-inside ml-4">
                    <li><strong>นิวเคลียส (Nucleus):</strong> ควบคุมการทำงานของเซลล์และเก็บสารพันธุกรรม</li>
                    <li><strong>ไมโทคอนเดรีย (Mitochondria):</strong> สร้างพลังงานให้เซลล์ (โรงไฟฟ้าของเซลล์)</li>
                    <li><strong>คลอโรพลาสต์ (Chloroplast - ในพืช):):</strong> สังเคราะห์แสง</li>
                    <li><strong>ไรโบโซม (Ribosome):</strong> สังเคราะห์โปรตีน</li>
                    <li><strong>เยื่อหุ้มเซลล์ (Cell Membrane):):</strong> ควบคุมการเข้าออกของสาร</li>
                </ul>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">วิดีโอประกอบการเรียนรู้</h3>
            `,
            videoUrl: "https://www.youtube.com/embed/Lf25lX_4XJ4"
        },
        postTest: [
            { id: "post_c1", question: "ออร์แกเนลล์ใดที่ทำหน้าที่สร้างพลังงานให้กับเซลล์?", options: ["นิวเคลียส", "ไรโบโซม", "ไมโทคอนเดรีย", "คลอโรพลาสต์"], answer: "ไมโทคอนเดรีย", explanation: "ไมโทคอนเดรียเป็นแหล่งผลิตพลังงานหลักของเซลล์ผ่านกระบวนการหายใจระดับเซลล์" }
        ]
    },
    "human-anatomy": {
        title: "กายวิภาคศาสตร์มนุษย์",
        preTest: [
            { id: "pre_h1", question: "อวัยวะใดทำหน้าที่หลักในการสูบฉีดเลือดไปเลี้ยงทั่วร่างกาย?", options: ["ปอด", "ตับ", "ไต", "หัวใจ"], answer: "หัวใจ", explanation: "หัวใจเป็นอวัยวะสำคัญในระบบไหลเวียนโลหิต ทำหน้าที่สูบฉีดเลือด" }
        ],
        content: {
            text: `
                <p><strong>กายวิภาคศาสตร์มนุษย์ (Human Anatomy)</strong> คือ การศึกษาโครงสร้างของร่างกายมนุษย์ในระดับมหัพภาคและจุลภาค</p>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">ระบบอวัยวะที่สำคัญ</h3>
                <ul class="list-disc list-inside ml-4">
                    <li><strong>ระบบโครงกระดูก (Skeletal System):</strong> ค้ำจุนร่างกาย, ป้องกันอวัยวะภายใน</li>
                    <li><strong>ระบบกล้ามเนื้อ (Muscular System):</strong> การเคลื่อนไหว</li>
                    <li><strong>ระบบประสาท (Nervous System):</strong> ควบคุมและประสานงานการทำงานของร่างกาย</li>
                    <li><strong>ระบบไหลเวียนโลหิต (Cardiovascular System):</strong> ขนส่งเลือด, ออกซิเจน, สารอาหาร</li>
                    <li><strong>ระบบหายใจ (Respiratory System):):</strong> แลกเปลี่ยนก๊าซ</li>
                    <li><strong>ระบบย่อยอาหาร (Digestive System):):</strong> ย่อยอาหารและดูดซึมสารอาหาร</li>
                    <li><strong>ระบบขับถ่ายปัสสาวะ (Urinary System):</strong> กำจัดของเสียจากเลือด</li>
                    <li><strong>ระบบต่อมไร้ท่อ (Endocrine System):):</strong> ควบคุมการทำงานผ่านฮอร์โมน</li>
                    <li><strong>ระบบสืบพันธุ์ (Reproductive System):</strong> การสืบพันธุ์</li>
                </ul>
                <h3 class="text-xl font-semibold mt-4 mb-2 text-gray-700">วิดีโอประกอบการเรียนรู้</h3>
            `,
            videoUrl: "https://www.youtube.com/embed/v9S5XgP5-48"
        },
        postTest: [
            { id: "post_h1", question: "หน้าที่หลักของระบบโครงกระดูกคืออะไร?", options: ["ย่อยอาหาร", "หายใจ", "ค้ำจุนร่างกายและป้องกันอวัยวะ", "ผลิตฮอร์โมน"], answer: "ค้ำจุนร่างกายและป้องกันอวัยวะ", explanation: "ระบบโครงกระดูกทำหน้าที่หลักในการค้ำจุนร่างกายและป้องกันอวัยวะภายในที่บอบบาง" }
        ]
    }
};


// Function to show custom message box
function showMessageBox(title, body, callback = null) {
    const messageBox = document.getElementById('messageBox');
    const messageBoxTitle = document.getElementById('messageBoxTitle');
    const messageBoxBody = document.getElementById('messageBoxBody');
    const messageBoxCloseBtn = document.getElementById('messageBoxCloseBtn');

    messageBoxTitle.textContent = title;
    messageBoxBody.textContent = body;
    messageBox.classList.remove('hidden');

    messageBoxCloseBtn.onclick = () => {
        messageBox.classList.add('hidden');
        if (callback && typeof callback === 'function') {
            callback(); // Execute callback after modal is hidden
        }
    };
}


// Function to show/hide sections
function showSection(sectionId) {
    const sections = ['preTestSection', 'taxonomyIntroSection', 'kingdomSelectionSection', 'contentSection', 'postTestSection', 'scoreSummarySection'];
    const dynamicBackButtonsContainer = document.getElementById('dynamicBackButtons');

    // Clear all dynamic back buttons first
    if (dynamicBackButtonsContainer) {
        dynamicBackButtonsContainer.innerHTML = '';
    }

    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            if (id === sectionId) {
                section.classList.add('active');
                section.classList.remove('hidden');

                // Add dynamic back buttons based on sectionId
                if (dynamicBackButtonsContainer) {
                    let backButton = null;
                    if (sectionId === 'taxonomyIntroSection') {
                        backButton = createBackButton(
                            'backFromTaxonomyIntroToPreTestBtn',
                            'กลับไปทำแบบทดสอบก่อนเรียน',
                            'M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z',
                            () => {
                                showSection('preTestSection');
                                // Ensure questions are rendered with previous answers and disabled for review
                                renderQuestions(window.currentLessonData.preTest, 'preTestQuestions', 'pre', true, userPreTestAnswers);
                                document.getElementById('submitPreTestBtn').disabled = true; // Keep disabled after review
                                document.getElementById('preTestResult').classList.remove('hidden'); // Ensure result is visible for review
                                document.getElementById('continueToContentBtn').classList.remove('hidden'); // Show continue button
                            }
                        );
                    } else if (sectionId === 'kingdomSelectionSection') {
                        backButton = createBackButton(
                            'backFromKingdomSelectionToTaxonomyIntroBtn',
                            'กลับไปภาพรวมอนุกรมวิธาน',
                            'M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z',
                            () => {
                                showSection('taxonomyIntroSection');
                                document.getElementById('generalIntroTitle').textContent = "ภาพรวมการจำแนกสิ่งมีชีวิต"; // Specific title for this back button
                                document.getElementById('generalIntroContent').innerHTML = window.currentLessonData.content.introductionText;
                                // Re-render general videos if they exist
                                renderGeneralTaxonomyVideos();
                            }
                        );
                    }
                    // The 'backToKingdomSelectionBtn' is a static button within the contentSection HTML
                    // and its event listener is attached once on DOMContentLoaded.
                    // No dynamic creation needed here for it.

                    if (backButton) {
                        dynamicBackButtonsContainer.appendChild(backButton);
                    }
                }
            } else {
                section.classList.remove('active');
                section.classList.add('hidden');
            }
        }
    });
}

// Function to create a back button dynamically
function createBackButton(id, text, iconPathD, onClickHandler) {
    const button = document.createElement('button');
    button.id = id;
    button.className = "bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-full transition duration-300 flex items-center mb-2"; // mb-2 for stacking
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="${iconPathD}" clip-rule="evenodd" />
        </svg>
        ${text}
    `;
    button.addEventListener('click', onClickHandler);
    return button;
}

// Function to generate questions (for both pre and post tests)
function renderQuestions(questions, containerId, testType, showAnswers = false, userAnswers = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`ไม่พบคอนเทนเนอร์ ${containerId}`);
        return;
    }
    container.innerHTML = ''; // Clear previous questions

    questions.forEach((q, index) => {
        const userAnswerObj = userAnswers[q.id]; // Get the stored answer object for this question
        const isSelectedAndCorrect = userAnswerObj && userAnswerObj.selected === q.answer;
        const selectedOptionText = userAnswerObj ? userAnswerObj.selected : 'ไม่ได้เลือก';
        
        const questionHtml = `
            <div class="question-item" data-question-id="${q.id}">
                <p>${index + 1}. ${q.question}</p>
                <div class="options-group">
                    ${q.options.map((option) => {
                        const isSelected = userAnswerObj && userAnswerObj.selected === option;
                        let labelClass = '';
                        
                        if (showAnswers) {
                            if (option === q.answer) {
                                labelClass += ' correct-answer-highlight'; // Always highlight the correct answer
                            }
                            if (isSelected) {
                                if (isSelectedAndCorrect) {
                                    labelClass += ' selected-correct'; // Highlight selected if correct
                                } else {
                                    labelClass += ' selected-incorrect'; // Highlight selected if incorrect
                                }
                            }
                        }
                        return `
                            <label class="flex items-center ${labelClass.trim()}">
                                <input type="radio" name="${testType}_q${q.id}" value="${option}" class="mr-2" 
                                    ${isSelected ? 'checked' : ''} ${showAnswers ? 'disabled' : ''}>
                                <span>${option}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
                <div class="question-explanation mt-4 p-3 rounded-md ${showAnswers ? (isSelectedAndCorrect ? 'bg-green-100' : 'bg-red-100') : ''}" 
                     style="display: ${showAnswers ? 'block' : 'none'};">
                    <p><strong>${showAnswers ? (isSelectedAndCorrect ? `<span class="text-green-700">${selectedOptionText} ถูกต้อง!!!</span>` : `<span class="text-red-700">${selectedOptionText} ผิดพลาด!!!</span><br><span class="text-blue-700">คำตอบที่ถูกต้องคือ: ${q.answer}</span>`) : ''}</strong><br>คำอธิบาย: ${q.explanation}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', questionHtml);
    });
}


// Function to check answers and calculate score
function checkAnswers(questions, containerId, resultId, testType) { 
    let score = 0;
    const container = document.getElementById(containerId);
    const resultDisplay = document.getElementById(resultId);
    
    if (!container || !resultDisplay) {
        console.error(`ไม่พบคอนเทนเนอร์ ${containerId} หรือ ${resultId} สำหรับตรวจสอบคำตอบ`);
        return { score: 0, answers: {} };
    }

    const currentTestAnswers = {};
    let allAnswered = true; // Flag to check if all questions have been answered

    // First pass: Collect all selected answers and check if all questions are answered
    questions.forEach(q => {
        const questionItem = container.querySelector(`.question-item[data-question-id="${q.id}"]`);
        if (!questionItem) return;

        const selectedOption = questionItem.querySelector(`input[name="${testType}_q${q.id}"]:checked`);
        const selectedValue = selectedOption ? selectedOption.value : null;

        if (selectedValue === null) {
            allAnswered = false; // Set flag to false if any question is not answered
        }
        
        // Store selected value and initial correctness (will be fully determined in second pass)
        currentTestAnswers[q.id] = { selected: selectedValue, correct: false };
    });

    // If not all questions are answered, show message and stop
    if (!allAnswered) {
        showMessageBox("คำเตือน", "กรุณาตอบคำถามให้ครบทุกข้อก่อนส่ง");
        return { score: -1, answers: {} }; // Return -1 to indicate incomplete
    }

    // Second pass: Calculate score, update UI, and store final answers
    questions.forEach(q => {
        const questionItem = container.querySelector(`.question-item[data-question-id="${q.id}"]`);
        if (!questionItem) return;

        const selectedOption = questionItem.querySelector(`input[name="${testType}_q${q.id}"]:checked`);
        const explanationDiv = questionItem.querySelector('.question-explanation');
        const labels = questionItem.querySelectorAll('label');

        // Clear previous highlight classes before re-applying
        labels.forEach(label => {
            label.classList.remove('selected-correct', 'selected-incorrect', 'correct-answer-highlight');
        });

        const selectedValue = selectedOption ? selectedOption.value : null;
        const isCorrect = selectedValue === q.answer; // Determine correctness for this question

        if (isCorrect) {
            score++;
            questionItem.classList.add('correct');
            if (selectedOption) selectedOption.parentElement.classList.add('selected-correct');
        } else {
            questionItem.classList.add('incorrect');
            if (selectedOption) selectedOption.parentElement.classList.add('selected-incorrect');
            // Highlight the correct answer when an incorrect one is selected
            const correctAnswerLabel = questionItem.querySelector(`input[value="${q.answer}"]`);
            if (correctAnswerLabel) {
                correctAnswerLabel.parentElement.classList.add('correct-answer-highlight');
            }
        }

        // Update explanation text with status and display it
        let explanationHeader = '';
        if (isCorrect) {
            explanationHeader = `<span class="text-green-700">${selectedValue} ถูกต้อง!!!</span>`;
        } else {
            explanationHeader = `<span class="text-red-700">${selectedValue || 'ไม่ได้เลือก'} ผิดพลาด!!!</span><br><span class="text-blue-700">คำตอบที่ถูกต้องคือ: ${q.answer}</span>`;
        }
        if (explanationDiv) {
            explanationDiv.innerHTML = `<p><strong>${explanationHeader}</strong><br>คำอธิบาย: ${q.explanation}</p>`;
            explanationDiv.style.display = 'block'; // Show explanation
            explanationDiv.style.backgroundColor = isCorrect ? '#d1fae5' : '#fee2e2'; // Set background color
        }
        
        // Update the correctness in currentTestAnswers for this question
        currentTestAnswers[q.id].correct = isCorrect;
    });

    resultDisplay.textContent = `คุณทำถูก ${score} ข้อ จาก ${questions.length} ข้อ`;
    resultDisplay.classList.remove('hidden');
    
    // Disable all radio buttons after successful submission
    container.querySelectorAll('input[type="radio"]').forEach(radio => radio.disabled = true);

    // Store answers globally based on test type
    if (testType === 'pre') {
        userPreTestAnswers = currentTestAnswers;
    } else if (testType === 'post') {
        userPostTestAnswers = currentTestAnswers;
    }

    return { score, answers: currentTestAnswers };
}

// Function to save score to Firestore
async function saveScore(lessonId, testType, score, answers) { // Added 'answers' parameter
    if (!currentUserId || !lessonId) {
        console.error("ไม่สามารถบันทึกคะแนนได้: ผู้ใช้ยังไม่ได้เข้าสู่ระบบหรือไม่มีรหัสบทเรียน");
        showMessageBox("ข้อผิดพลาด", "ไม่สามารถบันทึกคะแนนได้ กรุณาเข้าสู่ระบบอีกครั้ง");
        return;
    }

    const scoreDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/lesson_scores`, lessonId);
    const dataToSave = {
        lastUpdated: new Date().toISOString()
    };

    if (testType === 'pre') {
        dataToSave.preScore = score;
        dataToSave.userPreTestAnswers = answers; // Save the full answers object
    } else if (testType === 'post') {
        dataToSave.postScore = score;
        dataToSave.userPostTestAnswers = answers; // Save the full answers object
    }

    try {
        await setDoc(scoreDocRef, dataToSave, { merge: true });
        console.log(`บันทึกคะแนน ${testType} สำเร็จสำหรับบทเรียน ${lessonId}: ${score}`);

        // ** NEW: Send score data to Google Apps Script (Single Sheet) **
        if (GOOGLE_APPS_SCRIPT_WEB_APP_URL && GOOGLE_APPS_SCRIPT_WEB_APP_URL !== 'https://script.google.com/macros/s/AKfycby3yHKre1_e5YdHLVDx7qvLecVZf7t2mN9UeCTMFTPUbgs5HNd4A69nW1MrFE3QzEkW/exec') {
            // Ensure currentUserProfile is loaded before sending score data
            if (Object.keys(currentUserProfile).length === 0 || currentUserProfile.studentId === undefined || currentUserProfile.studentId === null) {
                // If profile is not fully loaded or studentId is missing, try to fetch it now.
                const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profiles`, "userProfile");
                const userProfileSnap = await getDoc(userProfileRef);
                if (userProfileSnap.exists()) {
                    currentUserProfile = userProfileSnap.data();
                    console.log("Refreshed user profile for score sync:", currentUserProfile);
                } else {
                    console.warn("User profile not found for score sync. Cannot send full data to Google Sheet.");
                    showMessageBox("ข้อควรทราบ", "โปรดกรอกข้อมูลโปรไฟล์ของคุณให้ครบถ้วน (โดยเฉพาะ เลขประจำตัว) เพื่อให้ข้อมูลคะแนนปรากฏใน Google Sheet ได้สมบูรณ์");
                    return; // Stop here if studentId cannot be determined
                }
            }

            // Ensure studentId is available and valid before sending
            if (currentUserProfile.studentId === undefined || currentUserProfile.studentId === null) {
                console.error("ไม่สามารถส่งข้อมูลคะแนนไป Google Sheet ได้: ไม่พบ 'เลขประจำตัว' ในโปรไฟล์ผู้ใช้");
                showMessageBox("ข้อผิดพลาด", "ไม่สามารถส่งข้อมูลคะแนนไป Google Sheet ได้ โปรดกรอก 'เลขประจำตัว' ในโปรไฟล์ของคุณก่อน");
                return;
            }

            try {
                const scoreDataToSend = {
                    type: 'score', // Indicate data type
                    data: {
                        uid: currentUserId, // Firebase UID (for internal tracking if needed)
                        lessonId: lessonId, // For internal tracking in Apps Script if needed for future logic
                        studentId: currentUserProfile.studentId, // 'เลขประจำตัว' for Sheets lookup
                        fullName: currentUserProfile.fullName || '',
                        class: currentUserProfile.class || '',
                        preScore: dataToSave.preScore,
                        postScore: dataToSave.postScore
                    }
                };
                console.log("กำลังส่งข้อมูลคะแนนไปยัง Google Apps Script (ชีทเดียว):", scoreDataToSend);
                const response = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
                    method: 'POST',
                    mode: 'cors', // Enable CORS
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(scoreDataToSend)
                });

                const result = await response.json();
                if (result.status === 'success') {
                    console.log("ส่งข้อมูลคะแนนไป Google Sheet สำเร็จ:", result.message);
                } else {
                    console.error("ข้อผิดพลาดในการส่งข้อมูลคะแนนไป Google Sheet:", result.message);
                }
            } catch (appsScriptError) {
                console.error("ข้อผิดพลาดในการเชื่อมต่อ Google Apps Script สำหรับคะแนน:", appsScriptError);
            }
        } else {
            console.warn("ไม่ได้ตั้งค่า GOOGLE_APPS_SCRIPT_WEB_APP_URL หรือยังเป็นค่าเริ่มต้น ไม่สามารถส่งข้อมูลคะแนนไป Google Sheet ได้");
        }

    } catch (error) {
        console.error(`ข้อผิดพลาดในการบันทึกคะแนน ${testType} สำหรับบทเรียน ${lessonId}:`, error.message);
        showMessageBox("ข้อผิดพลาด", `ไม่สามารถบันทึกคะแนน${testType}ได้: ${error.message}`);
    }
}

// Function to load lesson content or kingdom selection
async function loadLesson(lessonId) {
    window.currentLessonData = window.lessonsData[lessonId];
    if (!window.currentLessonData) {
        console.error("Lesson data not found for:", lessonId);
        showMessageBox("ข้อผิดพลาด", "ไม่พบบทเรียนนี้", () => {
            window.location.href = "home.html"; // Redirect back if lesson not found
        });
        return;
    }

    document.getElementById('lessonTitle').textContent = window.currentLessonData.title;

    // Fetch current user profile to be ready for sending to Apps Script
    // This is now done once user is authenticated
    if (currentUserId) { // Only fetch if user ID is available
        const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profiles`, "userProfile");
        try {
            const userProfileSnap = await getDoc(userProfileRef);
            if (userProfileSnap.exists()) {
                currentUserProfile = userProfileSnap.data();
            } else {
                currentUserProfile = {
                    fullName: auth.currentUser?.displayName || '',
                    class: '',
                    studentId: null
                };
            }
            console.log("Loaded current user profile on auth state change:", currentUserProfile);
        } catch (error) {
            console.error("Error loading user profile on auth state change:", error);
            currentUserProfile = {
                fullName: auth.currentUser?.displayName || '',
                class: '',
                studentId: null
            };
        }
    }


    // Always start with Pre-test section, then load state
    showSection('preTestSection');
    loadSavedLessonState(lessonId); // Call a new function to handle loading state
}

// New function to load saved lesson state from Firestore
async function loadSavedLessonState(lessonId) {
    // Only attempt to load if user is logged in
    if (!currentUserId) {
        console.log("No currentUserId, skipping loadSavedLessonState. Rendering fresh pre-test.");
        renderQuestions(window.currentLessonData.preTest, 'preTestQuestions', 'pre');
        document.getElementById('continueToContentBtn').classList.add('hidden'); // Ensure hidden initially
        document.getElementById('submitPreTestBtn').disabled = false; // Ensure enabled
        return;
    }

    const scoreDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/lesson_scores`, lessonId);
    try {
        const docSnap = await getDoc(scoreDocRef);
        if (docSnap.exists()) {
            const savedData = docSnap.data();
            console.log("Saved lesson data found:", savedData);

            // Load pre-test state
            if (savedData.userPreTestAnswers) {
                userPreTestAnswers = savedData.userPreTestAnswers;
                preTestScore = savedData.preScore || 0; // Ensure score is loaded too
                console.log("Pre-test answers loaded. Rendering in review mode.");
                // Render pre-test with saved answers and show explanations
                renderQuestions(window.currentLessonData.preTest, 'preTestQuestions', 'pre', true, userPreTestAnswers);
                document.getElementById('preTestResult').textContent = `คุณทำถูก ${preTestScore} ข้อ จาก ${window.currentLessonData.preTest.length} ข้อ`;
                document.getElementById('preTestResult').classList.remove('hidden');
                document.getElementById('continueToContentBtn').classList.remove('hidden'); // Show continue button
                document.getElementById('submitPreTestBtn').disabled = true; // Disable submit button
            } else {
                console.log("No saved pre-test answers for this lesson. Rendering fresh pre-test.");
                renderQuestions(window.currentLessonData.preTest, 'preTestQuestions', 'pre');
                document.getElementById('continueToContentBtn').classList.add('hidden'); // Hide continue button
                document.getElementById('submitPreTestBtn').disabled = false; // Ensure submit button is enabled
            }

            // Load post-test state (to enable "View Scores" if completed)
            if (savedData.userPostTestAnswers) {
                userPostTestAnswers = savedData.userPostTestAnswers;
                postTestScore = savedData.postScore || 0;
                // If post-test was completed, show view scores button
                if (document.getElementById('viewScoresBtn')) {
                    document.getElementById('viewScoresBtn').classList.remove('hidden');
                }
            } else {
                if (document.getElementById('viewScoresBtn')) {
                    document.getElementById('viewScoresBtn').classList.add('hidden');
                }
            }

        } else {
            console.log("No saved lesson data found for this user/lesson. Rendering fresh pre-test.");
            renderQuestions(window.currentLessonData.preTest, 'preTestQuestions', 'pre');
            document.getElementById('continueToContentBtn').classList.add('hidden'); // Hide continue button
            document.getElementById('submitPreTestBtn').disabled = false; // Ensure submit button is enabled
        }
    } catch (error) {
        console.error("ข้อผิดพลาดในการโหลดข้อมูลบทเรียนที่บันทึกไว้:", error.message);
        showMessageBox("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลบทเรียนที่บันทึกไว้ได้: " + error.message);
        // Fallback to rendering fresh pre-test if load fails
        renderQuestions(window.currentLessonData.preTest, 'preTestQuestions', 'pre');
        document.getElementById('continueToContentBtn').classList.add('hidden');
        document.getElementById('submitPreTestBtn').disabled = false;
    }
}

// Function to render general taxonomy videos (if they exist)
function renderGeneralTaxonomyVideos() {
    const generalIntroContent = document.getElementById('generalIntroContent');
    if (currentLessonId === 'taxonomy' && window.currentLessonData.content.generalVideoUrls && generalIntroContent) {
        const videoHtmlArray = window.currentLessonData.content.generalVideoUrls.map(url => `
            <div class="video-responsive mt-6">
                <iframe src="${url}?autoplay=0&controls=1&modestbranding=1&rel=0" 
                        title="วิดีโอการจำแนกสิ่งมีชีวิต" frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        `);
        generalIntroContent.insertAdjacentHTML('beforeend', videoHtmlArray.join(''));
    }
}


// Function to render the kingdom selection cards
function renderKingdomSelection() {
    const kingdomCardsContainer = document.getElementById('kingdomCardsContainer');
    const kingdomSelectionIntro = document.getElementById('kingdomSelectionIntro');
    if (!kingdomCardsContainer || !kingdomSelectionIntro) {
        console.error("Kingdom cards container or intro not found.");
        return;
    }
    kingdomCardsContainer.innerHTML = ''; // Clear previous cards
    kingdomSelectionIntro.innerHTML = window.currentLessonData.content.introductionText; // Load intro text

    const kingdoms = window.currentLessonData.content.kingdoms;
    for (const key in kingdoms) {
        const kingdom = kingdoms[key];
        const cardHtml = `
            <div class="kingdom-card" data-kingdom-id="${key}">
                <span class="kingdom-card-icon">${kingdom.icon}</span>
                <h3 class="text-xl font-bold text-amber-800 mb-2">${kingdom.name}</h3>
                <p class="text-amber-700 text-sm">คลิกเพื่อเรียนรู้เพิ่มเติม</p>
            </div>
        `;
        kingdomCardsContainer.insertAdjacentHTML('beforeend', cardHtml);
    }

    // Add event listeners to the newly created kingdom cards
    kingdomCardsContainer.querySelectorAll('.kingdom-card').forEach(card => {
        card.addEventListener('click', (event) => {
            const kingdomId = event.currentTarget.dataset.kingdomId;
            renderKingdomContent(kingdomId);
        });
    });
}

// Function to render specific kingdom content
function renderKingdomContent(kingdomId) {
    const kingdomData = window.currentLessonData.content.kingdoms[kingdomId];
    if (!kingdomData) {
        console.error("Kingdom data not found for:", kingdomId);
        showMessageBox("ข้อผิดพลาด", "ไม่พบเนื้อหาอาณาจักรนี้");
        return;
    }

    document.getElementById('kingdomContentTitle').textContent = kingdomData.name;
    const lessonContentDiv = document.getElementById('lessonContent');
    lessonContentDiv.innerHTML = kingdomData.text; // Load text content

    // Add video if available
    if (kingdomData.videoUrl) {
        const videoHtml = `
            <div class="video-responsive mt-6">
                <iframe src="${kingdomData.videoUrl}?autoplay=0&controls=1&modestbranding=1&rel=0" 
                        title="วิดีโอบทเรียน ${kingdomData.name}" frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        `;
        lessonContentDiv.insertAdjacentHTML('beforeend', videoHtml);
    }

    // Add slides if available (uncomment if you have slide URLs)
    if (kingdomData.slideUrl) {
        const slideHtml = `
            <div class="mt-6">
                <iframe src="${kingdomData.slideUrl}" 
                        frameborder="0" width="100%" height="400" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true" class="rounded-lg shadow-md"></iframe>
            </div>
        `;
        lessonContentDiv.insertAdjacentHTML('beforeend', slideHtml);
    }

    showSection('contentSection'); // Show the content section with kingdom data
}


// Function to fetch and display user scores
async function displayScoreSummary() {
    if (!currentUserId) {
        console.error("User not logged in. Cannot fetch scores.");
        return;
    }
    const scoreDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/lesson_scores`, currentLessonId);
    try {
        const docSnap = await getDoc(scoreDocRef);
        if (docSnap.exists()) {
            const scores = docSnap.data();
            document.getElementById('preScoreSummary').textContent = `${scores.preScore || 0} คะแนน`;
            document.getElementById('postScoreSummary').textContent = `${scores.postScore || 0} คะแนน`;
        } else {
            document.getElementById('preScoreSummary').textContent = 'ยังไม่มีคะแนน';
            document.getElementById('postScoreSummary').textContent = 'ยังไม่มีคะแนน';
        }
    } catch (error) {
        console.error("ข้อผิดพลาดในการดึงข้อมูลสรุปคะแนน:", error.message);
        showMessageBox("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลคะแนนได้: " + error.message);
    }
}


// --- Main Logic on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired."); // Debugging line

    // Get lesson ID from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    currentLessonId = urlParams.get('id');

    console.log("Current lesson ID from URL:", currentLessonId); // Debugging line

    // Get DOM elements for navigation
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    const submitPreTestBtn = document.getElementById('submitPreTestBtn');
    const continueToContentBtn = document.getElementById('continueToContentBtn'); // This button now leads to kingdom selection
    const startTaxonomyLessonBtn = document.getElementById('startTaxonomyLessonBtn'); // New button for Taxonomy Intro
    const backFromTaxonomyIntroToPreTestBtn = document.getElementById('backFromTaxonomyIntroToPreTestBtn'); // New button to go from taxonomy intro back to pre-test
    const backFromKingdomSelectionToTaxonomyIntroBtn = document.getElementById('backFromKingdomSelectionToTaxonomyIntroBtn'); // New button to go from kingdom selection back to taxonomy intro
    const backToKingdomSelectionBtn = document.getElementById('backToKingdomSelectionBtn'); // Static button to go from specific kingdom content back to kingdom selection
    const finishContentBtn = document.getElementById('finishContentBtn'); // This button now leads to post-test from specific kingdom content
    const submitPostTestBtn = document.getElementById('submitPostTestBtn');
    const viewScoresBtn = document.getElementById('viewScoresBtn');
    const returnToHomeFromSummaryBtn = document.getElementById('returnToHomeFromSummaryBtn');


    if (!currentLessonId || !lessonsData[currentLessonId]) {
        console.error("Lesson data lookup failed:", currentLessonId, lessonsData[currentLessonId]); // Debugging line
        showMessageBox("ข้อผิดพลาด", "ไม่พบบทเรียนที่ระบุ!", () => {
            window.location.href = "home.html"; // Redirect back if lesson not found
        });
        return;
    }

    // Assign to window.currentLessonData
    window.currentLessonData = lessonsData[currentLessonId];
    document.getElementById('lessonTitle').textContent = window.currentLessonData.title;

    // Handle authentication state first
    onAuthStateChanged(auth, async (user) => { // Make async to await profile fetch
        if (user) {
            currentUserId = user.uid;
            console.log("ผู้ใช้เข้าสู่ระบบในหน้าบทเรียน:", currentUserId);
            // Fetch current user profile after authentication to populate currentUserProfile
            const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profiles`, "userProfile");
            try {
                const userProfileSnap = await getDoc(userProfileRef);
                if (userProfileSnap.exists()) {
                    currentUserProfile = userProfileSnap.data();
                } else {
                    currentUserProfile = {
                        fullName: user.displayName || '',
                        class: '',
                        studentId: null
                    };
                }
                console.log("Loaded current user profile on auth state change:", currentUserProfile);
            } catch (error) {
                console.error("Error loading user profile on auth state change:", error);
                currentUserProfile = {
                    fullName: user.displayName || '',
                    class: '',
                    studentId: null
                };
            }
            await loadLesson(currentLessonId); // Load lesson state after currentUserId and profile are set
        } else {
            currentUserId = null;
            currentUserProfile = {}; // Clear profile if no user
            console.log("ผู้ใช้ออกจากระบบในหน้าบทเรียน คุณสมบัติบางอย่างอาจถูกจำกัด");
            loadLesson(currentLessonId); // Still load the content, but without user-specific data
        }
    });

    // Event Listeners for navigation and tests
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            window.location.href = "home.html";
        });
    }

    if (submitPreTestBtn) {
        submitPreTestBtn.addEventListener('click', async () => {
            if (!auth.currentUser) {
                showMessageBox("เข้าสู่ระบบ", "กรุณาเข้าสู่ระบบก่อนทำแบบทดสอบ");
                return;
            }
            // Validate if all questions are answered for pre-test
            const { score, answers } = checkAnswers(window.currentLessonData.preTest, 'preTestQuestions', 'preTestResult', 'pre');
            if (score === -1) return; // If not all answered, stop here

            preTestScore = score;
            userPreTestAnswers = answers; // Store answers for review

            await saveScore(currentLessonId, 'pre', preTestScore, userPreTestAnswers); // Pass answers
            showMessageBox("ผลคะแนนก่อนเรียน", `คุณทำได้ ${preTestScore} คะแนน`, () => {
                // After closing message box, show kingdom selection for taxonomy, otherwise show general content
                if (currentLessonId === 'taxonomy') {
                    showSection('taxonomyIntroSection'); // Go to general intro first for taxonomy
                    document.getElementById('generalIntroTitle').textContent = "ภาพรวมการจำแนกสิ่งมีชีวิต";
                    document.getElementById('generalIntroContent').innerHTML = window.currentLessonData.content.introductionText;
                    renderGeneralTaxonomyVideos(); // Render general videos for taxonomy intro
                } else {
                    showSection('contentSection');
                    // For non-taxonomy lessons, this means just showing their single content block
                    renderLessonContent(); 
                }
                if (submitPreTestBtn) submitPreTestBtn.disabled = true; // Disable submit button
            });
            
        });
    }

    // This button (Continue to Content) now only functions for all lessons to proceed to content/kingdom selection.
    if (continueToContentBtn) {
        continueToContentBtn.addEventListener('click', () => {
            if (currentLessonId === 'taxonomy') {
                showSection('taxonomyIntroSection'); // Go to general intro first for taxonomy
                document.getElementById('generalIntroTitle').textContent = "ภาพรวมการจำแนกสิ่งมีชีวิต";
                document.getElementById('generalIntroContent').innerHTML = window.currentLessonData.content.introductionText;
                renderGeneralTaxonomyVideos(); // Render general videos for taxonomy intro
            } else {
                showSection('contentSection');
                renderLessonContent();
            }
        });
    }

    // New button for Taxonomy lesson to proceed from general intro to kingdom selection
    if (startTaxonomyLessonBtn) { // Listener always attached, check lessonId inside
        startTaxonomyLessonBtn.addEventListener('click', () => {
            if (currentLessonId === 'taxonomy') {
                showSection('kingdomSelectionSection');
                startTaxonomyLessonBtn.textContent = 'เริ่มศึกษาอาณาจักรทั้ง5'
                renderKingdomSelection();
            }
        });
    }
    
    if (backToPreTestFromTaxonomyIntroBtn) {
        backToPreTestFromTaxonomyIntroBtn.addEventListener('click', () => {
            showSection('preTestSection');
            renderQuestions(window.currentLessonData.preTest, 'preTestQuestions', 'pre', true, userPreTestAnswers);
            if (submitPreTestBtn) submitPreTestBtn.disabled = true;
            if (continueToContentBtn) continueToContentBtn.classList.remove('hidden');
        });
    }

    if (backFromKingdomSelectionToTaxonomyIntroBtn) {
    console.log("ปุ่มย้อนกลับจากอาณาจักร → taxonomy intro ถูกพบ");
    backFromKingdomSelectionToTaxonomyIntroBtn.addEventListener('click', () => {
        console.log("ผู้ใช้กดปุ่มย้อนกลับไป taxonomy intro");
        showSection('taxonomyIntroSection');
        document.getElementById('generalIntroTitle').textContent = "ภาพรวมการจำแนกสิ่งมีชีวิต";
        document.getElementById('generalIntroContent').innerHTML = window.currentLessonData.content.introductionText;
        renderGeneralTaxonomyVideos();
    });
} else {
    console.warn("ไม่พบปุ่ม backFromKingdomSelectionToTaxonomyIntroBtn ใน DOM");
}


    if (backToKingdomSelectionBtn) {
        backToKingdomSelectionBtn.addEventListener('click', () => {
            showSection('kingdomSelectionSection');
            renderKingdomSelection(); // Re-render the kingdom selection cards
        });
    }

    if (finishContentBtn) {
        finishContentBtn.addEventListener('click', () => {
            showSection('postTestSection');
            // Render post-test questions fresh for new attempt
            renderQuestions(window.currentLessonData.postTest, 'postTestQuestions', 'post');
            // Make sure submit button is enabled for a new attempt
            if (submitPostTestBtn) submitPostTestBtn.disabled = false;
        });
    }

    if (submitPostTestBtn) {
        submitPostTestBtn.addEventListener('click', async () => {
            if (!auth.currentUser) {
                showMessageBox("เข้าสู่ระบบ", "กรุณาเข้าสู่ระบบก่อนทำแบบทดสอบ");
                return;
            }
            // Validate if all questions are answered for post-test
            const { score, answers } = checkAnswers(window.currentLessonData.postTest, 'postTestQuestions', 'postTestResult', 'post');
            if (score === -1) return; // If not all answered, stop here

            postTestScore = score;
            userPostTestAnswers = answers; // Store answers for review
            
            await saveScore(currentLessonId, 'post', postTestScore, userPostTestAnswers); // Pass answers
            showMessageBox("ผลคะแนนหลังเรียน", `คุณทำได้ ${postTestScore} คะแนน`, () => {
                if (viewScoresBtn) viewScoresBtn.classList.remove('hidden'); // Ensure button is visible after message
            });
            if (submitPostTestBtn) submitPostTestBtn.disabled = true; // Disable submit button
        });
    }

    if (viewScoresBtn) {
        viewScoresBtn.addEventListener('click', async () => {
            showSection('scoreSummarySection');
            await displayScoreSummary();
        });
    }

    if (returnToHomeFromSummaryBtn) {
        returnToHomeFromSummaryBtn.addEventListener('click', () => {
            window.location.href = "home.html";
        });
    }
});

// Function to render lesson content (text, video, slides) - for non-taxonomy lessons
function renderLessonContent() {
    const lessonContentDiv = document.getElementById('lessonContent');
    lessonContentDiv.innerHTML = ''; // Clear previous content

    // Add text content
    if (window.currentLessonData.content.text) {
        lessonContentDiv.insertAdjacentHTML('beforeend', window.currentLessonData.content.text);
    }

    // Add video if available
    if (window.currentLessonData.content.videoUrl) {
        const videoHtml = `
            <div class="video-responsive mt-6">
                <iframe src="${window.currentLessonData.content.videoUrl}?autoplay=0&controls=1&modestbranding=1&rel=0" 
                        title="วิดีโอบทเรียน" frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        `;
        lessonContentDiv.insertAdjacentHTML('beforeend', videoHtml);
    }

    // Add slides if available (uncomment if you have slide URLs)
    // if (window.currentLessonData.content.slideUrl) {
    //     const slideHtml = `
    //         <div class="mt-6">
    //             <iframe src="${window.currentLessonData.content.slideUrl}" 
    //                     frameborder="0" width="100%" height="400" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
    //         </div>
    //     `;
    //     lessonContentDiv.insertAdjacentHTML('beforeend', slideHtml);
    // }
}
