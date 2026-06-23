from .health import health_bp
from .auth import auth_bp
from .decks import decks_bp
from .study import study_bp


def register_routes(app):
    """Register all blueprints with the Flask app"""
    blueprints = [auth_bp, health_bp, decks_bp, study_bp]
    for bp in blueprints:
        app.register_blueprint(bp)
