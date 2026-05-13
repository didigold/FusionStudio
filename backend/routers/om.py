from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
async def generate_report():
    return {"status": "not_implemented"}