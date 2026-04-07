from django.contrib import admin
from django.urls import include, re_path


urlpatterns = [
    re_path(r"^django-admin/", admin.site.urls),
    re_path(r"^api/", include("api.urls")),
    re_path(r"^(?!api/|django-admin/).*", include("api.urls_spa")),
]
