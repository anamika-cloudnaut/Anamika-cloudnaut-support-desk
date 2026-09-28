from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from database.app.database import engine


def initialize_database():
    config = Config("/app/database/alembic.ini")
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "alembic_version" in tables and "ticket_notes" in tables:
        with engine.begin() as connection:
            revision = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one_or_none()
            if revision == "add_ticket_notes":
                connection.execute(
                    text("UPDATE alembic_version SET version_num = :revision"),
                    {"revision": "4a6f4c2d7b11"},
                )
    if "team_members" in tables and "alembic_version" not in tables:
        baseline = "4a6f4c2d7b11" if "ticket_notes" in tables else "d1fead5c1331"
        command.stamp(config, baseline)
    command.upgrade(config, "head")


if __name__ == "__main__":
    initialize_database()