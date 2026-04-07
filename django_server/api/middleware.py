from django.conf import settings
from django.http import HttpResponse


class SimpleCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        origin = request.headers.get("Origin", "")
        allowed_origin = getattr(settings, "ALLOWED_ORIGIN", "")
        if origin and origin == allowed_origin:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"

        return response
