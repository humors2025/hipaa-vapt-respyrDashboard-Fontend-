import { API_BASE_URL, API_ENDPOINTS } from "@/config/apiConfig";

export async function POST(request) {
  const body = await request.json();
  const auth = request.headers.get("authorization");
  const res = await fetch(
    `${API_BASE_URL}${API_ENDPOINTS.ADMINPANEL.TRAINERLISTINVITES}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
