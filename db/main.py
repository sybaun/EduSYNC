from fastapi import Depends, FastAPI, HTTPException, Header, status, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import uuid
from fastapi.middleware.cors import CORSMiddleware
from .database import connect, execute, init_db, one, rows, is_postgres
from .security import create_token, decode_token, hash_password, verify_password
from .schemas import *

app = FastAPI(title="EduSync API", version="1.0.0-v5")

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()
    ensure_schema_upgrades()
    seed_demo_data()

def ensure_schema_upgrades():
    with connect() as conn:
        if is_postgres():
            execute(conn, "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS file_url TEXT")
            execute(conn, "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS file_name TEXT")
            execute(conn, "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_name TEXT")
        else:
            try:
                execute(conn, "ALTER TABLE assignments ADD COLUMN file_url TEXT")
            except Exception:
                pass
            try:
                execute(conn, "ALTER TABLE assignments ADD COLUMN file_name TEXT")
            except Exception:
                pass
            try:
                execute(conn, "ALTER TABLE submissions ADD COLUMN file_name TEXT")
            except Exception:
                pass

def save_upload(file: UploadFile | None):
    if not file or not file.filename:
        return None, None

    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    saved_name = f"{uuid.uuid4().hex}_{safe_name}"

    file_path = UPLOAD_DIR / saved_name

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return f"/uploads/{saved_name}", file.filename

def seed_demo_data():
    """Create only demo users. No hardcoded courses/materials/assignments.
    Courses should appear only after a teacher creates them.
    """
    with connect() as conn:
        demo_users = [
            ("admin@edusync.edu", "Admin EduSync", "admin"),
            ("teacher@edusync.edu", "Anna Nowak", "teacher"),
            ("student@edusync.edu", "Jan Kowalski", "student"),
        ]
        for email, name, role in demo_users:
            if not one(execute(conn, "SELECT id FROM users WHERE email=?", [email])):
                execute(
                    conn,
                    "INSERT INTO users(email, full_name, password_hash, role) VALUES(?,?,?,?)",
                    [email, name, hash_password("password123"), role],
                )

def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = decode_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    with connect() as conn:
        user = one(execute(conn, "SELECT id,email,full_name,role,is_active,created_at FROM users WHERE id=?", [payload["sub"]]))
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="Inactive user")
    return user


def require_roles(*roles: str):
    def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


@app.get("/health")
def health():
    return {"status": "ok", "service": "edusync-api"}

@app.post("/api/auth/register")
def register(data: RegisterIn):
    if data.role not in {"admin", "teacher", "student"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    with connect() as conn:
        try:
            cur = execute(conn, "INSERT INTO users(email, full_name, password_hash, role) VALUES(?,?,?,?)", [data.email, data.full_name, hash_password(data.password), data.role])
            user_id = cur.lastrowid if hasattr(cur, "lastrowid") else one(execute(conn, "SELECT id FROM users WHERE email=?", [data.email]))["id"]
        except Exception:
            raise HTTPException(status_code=409, detail="Email already exists")
    return {"id": user_id, "email": data.email, "role": data.role}

@app.post("/api/auth/login")
def login(data: LoginIn):
    with connect() as conn:
        user = one(execute(conn, "SELECT * FROM users WHERE email=?", [data.email]))
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token({"sub": user["id"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user["id"], "email": user["email"], "full_name": user["full_name"], "role": user["role"]}}

@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return user

@app.get("/api/users")
def list_users(user=Depends(current_user)):
    with connect() as conn:
        if user["role"] == "student":
            # студент видит преподавателей своих курсов + админов
            sql = """
                SELECT DISTINCT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at
                FROM users u
                LEFT JOIN courses c ON c.teacher_id = u.id
                LEFT JOIN enrollments e ON e.course_id = c.id
                WHERE u.is_active = 1
                  AND u.id != ?
                  AND (
                    u.role = 'admin'
                    OR (u.role = 'teacher' AND e.student_id = ?)
                  )
                ORDER BY u.role, u.full_name
            """
            return rows(execute(conn, sql, [user["id"], user["id"]]))

        # teacher/admin видят всех активных пользователей, кроме себя
        return rows(execute(
            conn,
            """
            SELECT id, email, full_name, role, is_active, created_at
            FROM users
            WHERE is_active = 1 AND id != ?
            ORDER BY role, full_name
            """,
            [user["id"]]
        ))
    
@app.get("/api/courses")
def list_courses(user=Depends(current_user)):
    with connect() as conn:
        if user["role"] == "student":
            sql = "SELECT c.* FROM courses c JOIN enrollments e ON e.course_id=c.id WHERE e.student_id=? ORDER BY c.id"
            return rows(execute(conn, sql, [user["id"]]))
        if user["role"] == "teacher":
            return rows(execute(conn, "SELECT * FROM courses WHERE teacher_id=? ORDER BY id", [user["id"]]))
        return rows(execute(conn, "SELECT * FROM courses ORDER BY id"))

@app.post("/api/courses")
def create_course(data: CourseIn, user=Depends(require_roles("teacher", "admin"))):
    teacher_id = user["id"]
    with connect() as conn:
        if is_postgres():
            cur = execute(
                conn,
                "INSERT INTO courses(title, description, teacher_id) VALUES(?,?,?) RETURNING id",
                [data.title, data.description, teacher_id],
            )
            course_id = cur.fetchone()["id"]
        else:
            cur = execute(
                conn,
                "INSERT INTO courses(title, description, teacher_id) VALUES(?,?,?)",
                [data.title, data.description, teacher_id],
            )
            course_id = cur.lastrowid

        execute(conn, "INSERT INTO modules(course_id, title, position) VALUES(?,?,?)", [course_id, "Moduł główny", 1])

        # Local demo behavior: every existing student is automatically enrolled
        # so the student can immediately see newly created teacher courses.
        students = rows(execute(conn, "SELECT id FROM users WHERE role='student' AND is_active=1"))
        for student in students:
            if is_postgres():
                execute(
                    conn,
                    """
                    INSERT INTO enrollments(student_id, course_id)
                    VALUES(?, ?)
                    ON CONFLICT(student_id, course_id) DO NOTHING
                    """,
                    [student["id"], course_id],
                )
            else:
                execute(
                    conn,
                    "INSERT OR IGNORE INTO enrollments(student_id, course_id) VALUES(?, ?)",
                    [student["id"], course_id],
                )

        return one(execute(conn, "SELECT * FROM courses WHERE id=?", [course_id]))

@app.get("/api/courses/{course_id}")
def course_details(course_id: int, user=Depends(current_user)):
    with connect() as conn:
        course = one(execute(conn, "SELECT * FROM courses WHERE id=?", [course_id]))
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Basic access control: students can open only enrolled courses,
        # teachers can open only their own courses, admin can open all.
        if user["role"] == "student":
            enrolled = one(execute(
                conn,
                "SELECT 1 FROM enrollments WHERE course_id=? AND student_id=?",
                [course_id, user["id"]],
            ))
            if not enrolled:
                raise HTTPException(status_code=403, detail="Not enrolled")
        elif user["role"] == "teacher" and course["teacher_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your course")

        course["modules"] = rows(execute(conn, "SELECT * FROM modules WHERE course_id=? ORDER BY position,id", [course_id]))
        for m in course["modules"]:
            m["materials"] = rows(execute(conn, "SELECT * FROM materials WHERE module_id=?", [m["id"]]))
            if user["role"] == "student":
                m["assignments"] = rows(execute(
                    conn,
                    """
                    SELECT
                        a.*,
                        s.id AS submission_id,
                        s.content AS submission_content,
                        s.file_url AS submission_file_url,
                        s.file_name AS submission_file_name,
                        s.submitted_at AS submitted_at,
                        g.id AS submission_grade_id,
                        g.value AS submission_grade_value,
                        g.comment AS submission_grade_comment
                    FROM assignments a
                    LEFT JOIN submissions s
                        ON s.assignment_id = a.id
                       AND s.student_id = ?
                    LEFT JOIN grades g
                        ON g.submission_id = s.id
                    WHERE a.module_id = ?
                    ORDER BY a.id
                    """,
                    [user["id"], m["id"]],
                ))
            else:
                m["assignments"] = rows(execute(conn, "SELECT * FROM assignments WHERE module_id=? ORDER BY id", [m["id"]]))
        return course

@app.post("/api/courses/{course_id}/enroll/{student_id}")
def enroll(course_id: int, student_id: int, user=Depends(require_roles("teacher", "admin"))):
    with connect() as conn:
        if is_postgres():
            execute(conn, "INSERT INTO enrollments(student_id, course_id) VALUES(?,?) ON CONFLICT DO NOTHING", [student_id, course_id])
        else:
            execute(conn, "INSERT OR IGNORE INTO enrollments(student_id, course_id) VALUES(?,?)", [student_id, course_id])
    return {"status": "enrolled"}

@app.post("/api/courses/{course_id}/modules")
def add_module(course_id: int, data: ModuleIn, user=Depends(require_roles("teacher", "admin"))):
    with connect() as conn:
        cur = execute(conn, "INSERT INTO modules(course_id,title,position) VALUES(?,?,?)", [course_id, data.title, data.position])
        mid = cur.lastrowid if hasattr(cur, "lastrowid") else one(execute(conn, "SELECT id FROM modules WHERE course_id=? ORDER BY id DESC", [course_id]))["id"]
        return one(execute(conn, "SELECT * FROM modules WHERE id=?", [mid]))

@app.post("/api/modules/{module_id}/materials")
def add_material(
    module_id: int,
    title: str = Form(...),
    material_type: str = Form("link"),
    url: str = Form(""),
    file: UploadFile | None = File(None),
    user=Depends(require_roles("teacher", "admin")),
):
    with connect() as conn:
        module = one(execute(
            conn,
            """
            SELECT m.*, c.teacher_id
            FROM modules m
            JOIN courses c ON c.id = m.course_id
            WHERE m.id = ?
            """,
            [module_id],
        ))
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        if user["role"] == "teacher" and module["teacher_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your course")

        file_url, file_name = save_upload(file)
        final_url = file_url or url.strip()
        final_type = "file" if file_url else (material_type or "link")
        if not final_url:
            raise HTTPException(status_code=400, detail="Material file or URL is required")

        if is_postgres():
            cur = execute(
                conn,
                """
                INSERT INTO materials(module_id, title, material_type, url)
                VALUES(?, ?, ?, ?)
                RETURNING id
                """,
                [module_id, title.strip() or (file_name or "Materiał"), final_type, final_url],
            )
            mid = cur.fetchone()["id"]
        else:
            cur = execute(
                conn,
                "INSERT INTO materials(module_id,title,material_type,url) VALUES(?,?,?,?)",
                [module_id, title.strip() or (file_name or "Materiał"), final_type, final_url],
            )
            mid = cur.lastrowid
        return one(execute(conn, "SELECT * FROM materials WHERE id=?", [mid]))

@app.post("/api/modules/{module_id}/assignments")
def add_assignment(
    module_id: int,
    title: str = Form(...),
    description: str = Form(""),
    deadline: str = Form(...),
    file: UploadFile | None = File(None),
    user=Depends(require_roles("teacher", "admin"))
):
    with connect() as conn:
        module = one(execute(
            conn,
            """
            SELECT m.*, c.teacher_id
            FROM modules m
            JOIN courses c ON c.id = m.course_id
            WHERE m.id = ?
            """,
            [module_id]
        ))

        if not module:
            raise HTTPException(status_code=404, detail="Module not found")

        if user["role"] == "teacher" and module["teacher_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your course")

        file_url, file_name = save_upload(file)

        if is_postgres():
            cur = execute(
                conn,
                """
                INSERT INTO assignments(module_id, title, description, deadline, file_url, file_name)
                VALUES(?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                [module_id, title, description, deadline, file_url, file_name],
            )
            aid = cur.fetchone()["id"]
        else:
            cur = execute(
                conn,
                """
                INSERT INTO assignments(module_id, title, description, deadline, file_url, file_name)
                VALUES(?, ?, ?, ?, ?, ?)
                """,
                [module_id, title, description, deadline, file_url, file_name],
            )
            aid = cur.lastrowid

        return one(execute(conn, "SELECT * FROM assignments WHERE id=?", [aid]))
@app.post("/api/assignments/{assignment_id}/submit")
def submit_assignment(
    assignment_id: int,
    content: str = Form(""),
    file: UploadFile | None = File(None),
    user=Depends(require_roles("student"))
):
    with connect() as conn:
        assignment = one(execute(
            conn,
            """
            SELECT a.*, c.id AS course_id
            FROM assignments a
            JOIN modules m ON m.id = a.module_id
            JOIN courses c ON c.id = m.course_id
            JOIN enrollments e ON e.course_id = c.id
            WHERE a.id = ? AND e.student_id = ?
            """,
            [assignment_id, user["id"]]
        ))

        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        file_url, file_name = save_upload(file)

        existing = one(execute(
            conn,
            "SELECT * FROM submissions WHERE assignment_id=? AND student_id=?",
            [assignment_id, user["id"]]
        ))

        if existing:
            existing_grade = one(execute(conn, "SELECT id FROM grades WHERE submission_id=?", [existing["id"]]))
            if existing_grade:
                raise HTTPException(status_code=409, detail="Graded submission cannot be changed")

            final_file_url = file_url or existing["file_url"]
            final_file_name = file_name or existing.get("file_name")
            execute(
                conn,
                """
                UPDATE submissions
                SET content=?, file_url=?, file_name=?, submitted_at=CURRENT_TIMESTAMP
                WHERE assignment_id=? AND student_id=?
                """,
                [content, final_file_url, final_file_name, assignment_id, user["id"]]
            )
        else:
            execute(
                conn,
                """
                INSERT INTO submissions(assignment_id, student_id, content, file_url, file_name)
                VALUES(?, ?, ?, ?, ?)
                """,
                [assignment_id, user["id"], content, file_url, file_name]
            )

        return one(execute(
            conn,
            "SELECT * FROM submissions WHERE assignment_id=? AND student_id=?",
            [assignment_id, user["id"]]
        ))

@app.delete("/api/assignments/{assignment_id}/submission/me")
def delete_my_submission(assignment_id: int, user=Depends(require_roles("student"))):
    with connect() as conn:
        submission = one(execute(
            conn,
            """
            SELECT s.*
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN modules m ON m.id = a.module_id
            JOIN enrollments e ON e.course_id = m.course_id AND e.student_id = s.student_id
            WHERE s.assignment_id = ? AND s.student_id = ?
            """,
            [assignment_id, user["id"]],
        ))
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        existing_grade = one(execute(conn, "SELECT id FROM grades WHERE submission_id=?", [submission["id"]]))
        if existing_grade:
            raise HTTPException(status_code=409, detail="Graded submission cannot be deleted")

        execute(conn, "DELETE FROM submissions WHERE id=?", [submission["id"]])
        return {"status": "deleted"}

@app.delete("/api/submissions/{submission_id}")
def delete_submission(submission_id: int, user=Depends(require_roles("teacher", "admin"))):
    with connect() as conn:
        submission = one(execute(
            conn,
            """
            SELECT s.*, c.teacher_id
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN modules m ON m.id = a.module_id
            JOIN courses c ON c.id = m.course_id
            WHERE s.id = ?
            """,
            [submission_id],
        ))
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        if user["role"] == "teacher" and submission["teacher_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your submission")

        existing_grade = one(execute(conn, "SELECT id FROM grades WHERE submission_id=?", [submission_id]))
        if existing_grade:
            raise HTTPException(status_code=409, detail="Graded submission cannot be deleted")

        execute(conn, "DELETE FROM submissions WHERE id=?", [submission_id])
        return {"status": "deleted"}
    
@app.delete("/api/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, user=Depends(require_roles("teacher", "admin"))):
    with connect() as conn:
        assignment = one(execute(
            conn,
            """
            SELECT a.*, c.teacher_id
            FROM assignments a
            JOIN modules m ON m.id = a.module_id
            JOIN courses c ON c.id = m.course_id
            WHERE a.id = ?
            """,
            [assignment_id]
        ))

        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        if user["role"] == "teacher" and assignment["teacher_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your assignment")

        execute(conn, "DELETE FROM grades WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id=?)", [assignment_id])
        execute(conn, "DELETE FROM submissions WHERE assignment_id=?", [assignment_id])
        execute(conn, "DELETE FROM assignments WHERE id=?", [assignment_id])

        return {"status": "deleted"}
    
@app.get("/api/assignments/{assignment_id}/submissions")
def submissions(assignment_id: int, user=Depends(require_roles("teacher", "admin"))):
    with connect() as conn:
        assignment = one(execute(
            conn,
            """
            SELECT a.*, c.teacher_id
            FROM assignments a
            JOIN modules m ON m.id = a.module_id
            JOIN courses c ON c.id = m.course_id
            WHERE a.id = ?
            """,
            [assignment_id]
        ))

        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        if user["role"] == "teacher" and assignment["teacher_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your assignment")

        sql = """
        SELECT 
            s.*,
            u.full_name,
            u.email,
            g.id AS grade_id,
            g.value AS grade_value,
            g.comment AS grade_comment,
            g.created_at AS graded_at
        FROM submissions s
        JOIN users u ON u.id = s.student_id
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE s.assignment_id = ?
        ORDER BY 
            CASE WHEN g.id IS NULL THEN 0 ELSE 1 END,
            s.submitted_at DESC
        """
        return rows(execute(conn, sql, [assignment_id]))
    
@app.post("/api/submissions/{submission_id}/grade")
def grade_submission(submission_id: int, data: GradeIn, user=Depends(require_roles("teacher", "admin"))):
    with connect() as conn:
        sub = one(execute(
            conn,
            """
            SELECT s.*, m.course_id
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN modules m ON m.id = a.module_id
            WHERE s.id=?
            """,
            [submission_id]
        ))

        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")

        existing_grade = one(execute(
            conn,
            "SELECT id FROM grades WHERE submission_id=?",
            [submission_id]
        ))

        if existing_grade:
            raise HTTPException(status_code=409, detail="This submission is already graded")

        execute(
            conn,
            """
            INSERT INTO grades(submission_id, student_id, course_id, value, comment)
            VALUES(?, ?, ?, ?, ?)
            """,
            [submission_id, sub["student_id"], sub["course_id"], data.value, data.comment]
        )

        return one(execute(conn, "SELECT * FROM grades WHERE submission_id=?", [submission_id]))
    
@app.get("/api/grades/me")
def my_grades(user=Depends(require_roles("student"))):
    with connect() as conn:
        sql = "SELECT g.*, c.title AS course_title FROM grades g JOIN courses c ON c.id=g.course_id WHERE g.student_id=? ORDER BY g.created_at DESC"
        return rows(execute(conn, sql, [user["id"]]))

@app.get("/api/messages")
def list_messages(user=Depends(current_user)):
    with connect() as conn:
        sql = """SELECT m.*, us.full_name AS sender_name, ur.full_name AS receiver_name
                 FROM messages m
                 JOIN users us ON us.id=m.sender_id
                 JOIN users ur ON ur.id=m.receiver_id
                 WHERE m.receiver_id=? OR m.sender_id=?
                 ORDER BY m.created_at DESC"""
        return rows(execute(conn, sql, [user["id"], user["id"]]))

@app.post("/api/messages")
def send_message(data: MessageIn, user=Depends(current_user)):
    if data.receiver_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot send message to yourself")

    if not data.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required")

    if not data.body.strip():
        raise HTTPException(status_code=400, detail="Body is required")

    with connect() as conn:
        receiver = one(execute(
            conn,
            "SELECT id, role, is_active FROM users WHERE id=?",
            [data.receiver_id]
        ))

        if not receiver or not receiver["is_active"]:
            raise HTTPException(status_code=404, detail="Receiver not found")

        # студент может писать только преподам своих курсов или админу
        if user["role"] == "student" and receiver["role"] != "admin":
            allowed = one(execute(
                conn,
                """
                SELECT 1
                FROM courses c
                JOIN enrollments e ON e.course_id = c.id
                WHERE e.student_id = ?
                  AND c.teacher_id = ?
                LIMIT 1
                """,
                [user["id"], data.receiver_id]
            ))

            if not allowed:
                raise HTTPException(status_code=403, detail="You can message only your course teachers")

        cur = execute(
            conn,
            """
            INSERT INTO messages(sender_id, receiver_id, reply_to_id, subject, body)
            VALUES(?, ?, ?, ?, ?)
            """,
            [
                user["id"],
                data.receiver_id,
                data.reply_to_id,
                data.subject.strip(),
                data.body.strip(),
            ]
        )

        mid = cur.lastrowid if hasattr(cur, "lastrowid") else one(execute(
            conn,
            "SELECT id FROM messages WHERE sender_id=? ORDER BY id DESC",
            [user["id"]]
        ))["id"]

        return one(execute(
            conn,
            """
            SELECT m.*, us.full_name AS sender_name, ur.full_name AS receiver_name
            FROM messages m
            JOIN users us ON us.id = m.sender_id
            JOIN users ur ON ur.id = m.receiver_id
            WHERE m.id = ?
            """,
            [mid]
        ))

@app.patch("/api/messages/{message_id}/read")
def mark_read(message_id: int, user=Depends(current_user)):
    with connect() as conn:
        execute(conn, "UPDATE messages SET is_read=1 WHERE id=? AND receiver_id=?", [message_id, user["id"]])
    return {"status": "ok"}

@app.get("/api/notifications")
def notifications(user=Depends(current_user)):
    with connect() as conn:
        return rows(execute(conn, "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC", [user["id"]]))

@app.get("/api/assignments/me")
def my_assignments(user=Depends(require_roles("student"))):
    with connect() as conn:
        sql = """
        SELECT 
            a.*,
            c.id AS course_id,
            c.title AS course_title,
            m.title AS module_title,
            s.id AS submission_id,
            s.content AS submission_content,
            s.file_url AS submission_file_url,
            s.submitted_at
        FROM assignments a
        JOIN modules m ON m.id = a.module_id
        JOIN courses c ON c.id = m.course_id
        JOIN enrollments e ON e.course_id = c.id
        LEFT JOIN submissions s 
            ON s.assignment_id = a.id 
           AND s.student_id = ?
        WHERE e.student_id = ?
        ORDER BY a.deadline ASC
        """
        return rows(execute(conn, sql, [user["id"], user["id"]]))