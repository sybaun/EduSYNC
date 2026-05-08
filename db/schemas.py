from pydantic import BaseModel, EmailStr

class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "student"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class CourseIn(BaseModel):
    title: str
    description: str = ""

class ModuleIn(BaseModel):
    title: str
    position: int = 0

class MaterialIn(BaseModel):
    title: str
    material_type: str = "link"
    url: str

class AssignmentIn(BaseModel):
    title: str
    description: str = ""
    deadline: str

class SubmissionIn(BaseModel):
    content: str
    file_url: str | None = None

class GradeIn(BaseModel):
    value: float
    comment: str = ""

class MessageIn(BaseModel):
    receiver_id: int
    subject: str
    body: str
    reply_to_id: int | None = None
