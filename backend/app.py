import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from supabase import create_client, Client

from auth import require_auth
from email_utils import notify_task_created, notify_task_completed

app = Flask(__name__)
CORS(app, origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")])

# Service-role client: the BACKEND is trusted, so it talks to Supabase
# with the service role key, which bypasses Row Level Security. RLS on
# the tables still protects direct frontend-to-Supabase access, but
# all writes in this app go through these API routes, where we do our
# own authorization checks (see each route below).
supabase: Client = create_client(
    os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)


@app.get("/api/users")
@require_auth
def list_users():
    """Other users to assign tasks to (everyone except the caller)."""
    res = supabase.table("profiles").select("id, email, full_name").execute()
    users = [u for u in res.data if u["id"] != g.user_id]
    return jsonify(users)


@app.get("/api/tasks")
@require_auth
def list_tasks():
    """Tasks the caller created OR was assigned."""
    res = (
        supabase.table("tasks")
        .select("*, creator:created_by(email), assignee:assigned_to(email)")
        .or_(f"created_by.eq.{g.user_id},assigned_to.eq.{g.user_id}")
        .order("created_at", desc=True)
        .execute()
    )
    return jsonify(res.data)


@app.post("/api/tasks")
@require_auth
def create_task():
    body = request.get_json(force=True)
    title = (body.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    row = {
        "title": title,
        "description": body.get("description", ""),
        "status": "pending",
        "created_by": g.user_id,
        "assigned_to": body.get("assigned_to"),  # optional at creation
    }
    inserted = supabase.table("tasks").insert(row).execute().data[0]

    if row["assigned_to"]:
        assignee = (
            supabase.table("profiles")
            .select("email")
            .eq("id", row["assigned_to"])
            .single()
            .execute()
            .data
        )
        if assignee:
            notify_task_created(assignee["email"], title, g.user_email)

    return jsonify(inserted), 201


@app.post("/api/tasks/<task_id>/assign")
@require_auth
def assign_task(task_id):
    body = request.get_json(force=True)
    assigned_to = body.get("assigned_to")
    if not assigned_to:
        return jsonify({"error": "assigned_to is required"}), 400

    task = supabase.table("tasks").select("*").eq("id", task_id).single().execute().data
    if not task:
        return jsonify({"error": "task not found"}), 404
    if task["created_by"] != g.user_id:
        return jsonify({"error": "only the creator can assign this task"}), 403

    updated = (
        supabase.table("tasks")
        .update({"assigned_to": assigned_to})
        .eq("id", task_id)
        .execute()
        .data[0]
    )

    assignee = (
        supabase.table("profiles").select("email").eq("id", assigned_to).single().execute().data
    )
    if assignee:
        notify_task_created(assignee["email"], task["title"], g.user_email)

    return jsonify(updated)


@app.post("/api/tasks/<task_id>/complete")
@require_auth
def complete_task(task_id):
    task = supabase.table("tasks").select("*").eq("id", task_id).single().execute().data
    if not task:
        return jsonify({"error": "task not found"}), 404
    if task["assigned_to"] != g.user_id and task["created_by"] != g.user_id:
        return jsonify({"error": "not authorized to complete this task"}), 403

    updated = (
        supabase.table("tasks")
        .update({"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", task_id)
        .execute()
        .data[0]
    )

    creator = (
        supabase.table("profiles")
        .select("email")
        .eq("id", task["created_by"])
        .single()
        .execute()
        .data
    )
    if creator:
        notify_task_completed(creator["email"], task["title"], g.user_email)

    return jsonify(updated)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
