from django.urls import re_path

from .views import spa_view


urlpatterns = [
    re_path(r"^.*$", spa_view),
]
