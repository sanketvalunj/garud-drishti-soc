from fastapi import APIRouter

router = APIRouter(prefix="/ueba", tags=["UEBA"])

@router.get("/status")
async def get_ueba_status():
    return {"status": "inactive", "message": "UEBA engine placeholder"}
