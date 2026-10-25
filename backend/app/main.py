from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageStat
from io import BytesIO
import os
import tempfile

from .data import FOODS, RECIPES


# --------------------------------------------------
# APP CONFIGURATION
# --------------------------------------------------

app = FastAPI(
    title="Food Verse AI API",
    version="2.0.0",
    description=(
        "Educational food intelligence prototype using "
        "local AI inference without an external AI API."
    ),
)

origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# LOCAL FOOD RECOGNITION MODEL
# --------------------------------------------------

_classifier = None
_model_error = None

FOOD_LABELS = [
    "Maggi instant noodles",
    "Indian masala noodles",
    "vegetable noodles",
    "Chinese chow mein noodles",
    "spaghetti bolognese",
    "plain spaghetti pasta",
    "macaroni pasta",
    "vegetable fried rice",
    "biryani rice",
    "poha",
    "idli",
    "dosa",
    "samosa",
    "pakora",
    "pizza",
    "burger",
    "sandwich",
    "French fries",
    "vegetable salad",
    "dal rice",
    "rajma chawal",
    "paneer tikka",
    "chicken curry",
    "roti and sabzi",
    "upma",
    "pav bhaji",
    "chole bhature",
    "gulab jamun",
    "cake",
    "ice cream",
    "a bowl of fruit",
    "a non-food object",
]


def get_classifier():
    """
    Load CLIP locally.
    The model downloads its weights on the first run.
    No hosted AI inference API is used.
    """
    global _classifier, _model_error

    if _classifier is not None:
        return _classifier

    if _model_error:
        raise RuntimeError(_model_error)

    try:
        from transformers import pipeline

        _classifier = pipeline(
            task="zero-shot-image-classification",
            model="openai/clip-vit-base-patch32",
        )

        return _classifier

    except Exception as exc:
        _model_error = (
            "Could not load the local CLIP model. "
            "Check internet access, available RAM and disk space. "
            "The first run requires downloading model weights. "
            f"Technical detail: {type(exc).__name__}: {exc}"
        )

        raise RuntimeError(_model_error)


# --------------------------------------------------
# IMAGE VALIDATION
# --------------------------------------------------

async def read_image(file: UploadFile) -> Image.Image:
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, PNG or WEBP image.",
        )

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image is too large. Maximum size is 10 MB.",
        )

    try:
        image = Image.open(BytesIO(content)).convert("RGB")

        if image.width * image.height > 25_000_000:
            raise HTTPException(
                status_code=413,
                detail="Image dimensions are too large.",
            )

        return image

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )


# --------------------------------------------------
# NUTRITION DATA MATCHING
# --------------------------------------------------

def match_food(label: str):
    """
    Match a predicted label against the bundled food dataset.
    Do not invent nutrition values when no match is available.
    """
    normalized = (
        label.lower()
        .replace("_", " ")
        .replace("-", " ")
        .strip()
    )

    for item in FOODS:
        food_name = (
            item["name"]
            .lower()
            .replace("_", " ")
            .replace("-", " ")
            .strip()
        )

        if food_name in normalized or normalized in food_name:
            return item

    return None


# --------------------------------------------------
# BASIC ROUTES
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "name": "Food Verse AI API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "Food Verse AI",
        "model_loaded": _classifier is not None,
        "model_error": _model_error,
        "mode": "local CLIP inference; no hosted AI API",
    }


@app.get("/api/foods")
def foods():
    return {
        "foods": FOODS,
        "note": (
            "Bundled per-serving nutrition estimates. "
            "Values are estimates, not laboratory measurements."
        ),
    }


# --------------------------------------------------
# FOOD RECOGNITION
# --------------------------------------------------

@app.post("/api/food/recognize")
async def recognize_food(file: UploadFile = File(...)):
    image = await read_image(file)

    try:
        classifier = get_classifier()

        predictions = classifier(
            image,
            candidate_labels=FOOD_LABELS,
            hypothesis_template="a photo of {}",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    if not predictions:
        raise HTTPException(
            status_code=422,
            detail="The model returned no predictions.",
        )

    predictions = sorted(
        predictions,
        key=lambda prediction: float(
            prediction.get("score", 0)
        ),
        reverse=True,
    )

    best = predictions[0]

    label = str(
        best.get("label", "Unknown")
    ).strip()

    confidence = float(
        best.get("score", 0)
    )

    # A candidate match is not proof that the image contains this food.
    matched = (
        match_food(label)
        if label.lower() != "a non-food object"
        else None
    )

    nutrition = None

    if matched:
        nutrition = {
            "calories": matched["calories"],
            "protein_g": matched["protein"],
            "carbs_g": matched["carbs"],
            "fat_g": matched["fat"],
        }

    return {
        "prediction": label.title(),
        "confidence": confidence,

        "top_predictions": [
            {
                "label": str(
                    prediction.get("label", "Unknown")
                ).title(),
                "confidence": float(
                    prediction.get("score", 0)
                ),
            }
            for prediction in predictions[:5]
        ],

        "nutrition": nutrition,

        "nutrition_note": (
            "Nutrition is an approximate bundled estimate "
            "only when a matching food exists in the dataset. "
            "Serving size and recipe cannot be reliably inferred "
            "from a single image."
        ),

        "model_mode": "local CLIP zero-shot image classification",

        "warning": (
            "Predictions are candidate matches, not verified facts. "
            "The confidence score is not a guaranteed accuracy rate."
        ),
    }


# --------------------------------------------------
# FOOD FRESHNESS DEMO
# --------------------------------------------------

@app.post("/api/freshness/assess")
async def assess_freshness(file: UploadFile = File(...)):
    image = await read_image(file)

    small = image.resize((128, 128))
    statistics = ImageStat.Stat(small)

    mean_brightness = sum(statistics.mean[:3]) / 3
    colour_variation = sum(statistics.stddev[:3]) / 3

    return {
        "label": "Needs a closer look",

        "brightness_signal": round(
            mean_brightness, 1
        ),

        "colour_variation_signal": round(
            colour_variation, 1
        ),

        "explanation": (
            "Basic image statistics cannot reliably determine "
            "food freshness or safety. Inspect smell, texture, "
            "storage history and use-by guidance."
        ),

        "warning": (
            "This is not a trained freshness classifier. "
            "Never use this image result alone to decide "
            "whether food is safe to eat."
        ),

        "method": "basic image-statistics demonstration",
    }


# --------------------------------------------------
# RESTAURANT KITCHEN VIDEO REVIEW
# --------------------------------------------------

@app.post("/api/kitchen/review")
async def kitchen_review(file: UploadFile = File(...)):
    allowed_types = {
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/x-msvideo",
        "application/octet-stream",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Upload an MP4, MOV, AVI or WEBM video.",
        )

    content = await file.read()

    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Video too large. Maximum size is 50 MB.",
        )

    suffix = ".mp4"

    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[1][:8]

    path = None

    try:
        import cv2

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temporary_file:
            temporary_file.write(content)
            path = temporary_file.name

        capture = cv2.VideoCapture(path)

        if not capture.isOpened():
            raise HTTPException(
                status_code=400,
                detail="Could not read this video format.",
            )

        total_frames = int(
            capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        )

        fps = float(
            capture.get(cv2.CAP_PROP_FPS) or 0
        )

        duration = (
            round(total_frames / fps, 1)
            if total_frames > 0 and fps > 0
            else None
        )

        sampled_frames = 0

        if total_frames > 0:
            positions = [
                0,
                total_frames // 4,
                total_frames // 2,
                (3 * total_frames) // 4,
                max(0, total_frames - 1),
            ]

            for position in positions:
                capture.set(
                    cv2.CAP_PROP_POS_FRAMES,
                    position,
                )

                success, _frame = capture.read()

                if success:
                    sampled_frames += 1

        capture.release()

        return {
            "frames_sampled": sampled_frames,
            "duration_seconds": duration,

            "message": (
                "The video was read and sampled successfully. "
                "No trained hygiene detector is running."
            ),

            "limitation": (
                "Human review is required. This endpoint "
                "cannot detect or certify hygiene compliance."
            ),

            "review_checklist": [
                "Check appropriate glove use",
                "Check hair restraints",
                "Review raw and cooked food separation",
                "Review work surfaces and handwashing",
                "Check storage and temperature records",
            ],
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Video processing failed: "
                f"{type(exc).__name__}: {exc}"
            ),
        )

    finally:
        if path and os.path.exists(path):
            os.remove(path)


# --------------------------------------------------
# PERSONALIZED MEAL PLAN DEMO
# --------------------------------------------------

class PlanRequest(BaseModel):
    diet: str = "Vegetarian"
    goal: str = "Balanced"


@app.post("/api/meal-plan")
def meal_plan(request: PlanRequest):
    diet = request.diet.strip().lower()
    goal = request.goal.strip().lower()

    if diet not in (
        "vegetarian",
        "non-vegetarian",
        "vegan",
    ):
        raise HTTPException(
            status_code=400,
            detail="Unsupported diet preference.",
        )

    if goal not in (
        "balanced",
        "higher protein",
        "light meals",
    ):
        raise HTTPException(
            status_code=400,
            detail="Unsupported meal goal.",
        )

    candidates = []

    for food in FOODS:
        name = food["name"].lower()

        if diet == "vegan" and name in (
            "paneer tikka",
            "idli",
        ):
            # Idli ingredients vary; verify before treating
            # a recipe as vegan.
            continue

        if diet == "non-vegetarian" and name == "paneer tikka":
            continue

        candidates.append(food)

    if goal == "higher protein":
        candidates.sort(
            key=lambda food: food["protein"],
            reverse=True,
        )

    elif goal == "light meals":
        candidates.sort(
            key=lambda food: food["calories"]
        )

    if not candidates:
        raise HTTPException(
            status_code=422,
            detail="No matching foods in the bundled dataset.",
        )

    names = [
        "Idli",
        "Poha",
        "Dal rice",
        "Vegetable salad",
        "Apple",
        "Rajma chawal",
        "Banana",
        "Paneer tikka",
        "Chicken biryani",
    ]

    if diet == "vegan":
        names = [
            "Poha",
            "Dal rice",
            "Vegetable salad",
            "Apple",
            "Rajma chawal",
            "Banana",
        ]

    elif diet == "non-vegetarian":
        names = [
            "Chicken biryani",
            "Apple",
            "Dal rice",
            "Vegetable salad",
            "Banana",
        ]

    by_name = {
        food["name"].lower(): food
        for food in candidates
    }

    selected = []

    for name in names:
        food = by_name.get(name.lower())

        if food and food not in selected:
            selected.append(food)

    if not selected:
        selected = candidates[:4]

    if goal == "higher protein":
        selected.sort(
            key=lambda food: food["protein"],
            reverse=True,
        )

    elif goal == "light meals":
        selected.sort(
            key=lambda food: food["calories"]
        )

    slots = [
        "Breakfast",
        "Lunch",
        "Snack",
        "Dinner",
    ]

    meals = []

    for index, slot in enumerate(slots):
        food = selected[index % len(selected)]

        meals.append({
            "meal": slot,
            "food": food["name"],
            "calories": food["calories"],
            "protein_g": food["protein"],
        })

    return {
        "diet": request.diet,
        "goal": request.goal,
        "meals": meals,

        "note": (
            "Illustrative meal plan from bundled sample data. "
            "Not a medically personalized diet. Verify serving "
            "sizes, ingredients and allergens."
        ),
    }