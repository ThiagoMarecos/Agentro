"""Add commerce fields to products, variants, images, categories

Revision ID: 004
Revises: 003
Create Date: 2025-03-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Category: is_active
    op.add_column("categories", sa.Column("is_active", sa.Boolean(), server_default="true"))

    # Product: new fields
    op.add_column("products", sa.Column("short_description", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("status", sa.String(50), server_default="active"))
    op.add_column("products", sa.Column("product_type", sa.String(50), server_default="simple"))
    op.add_column("products", sa.Column("has_variants", sa.Boolean(), server_default="false"))
    op.add_column("products", sa.Column("is_featured", sa.Boolean(), server_default="false"))
    op.add_column("products", sa.Column("cover_image_url", sa.String(512), nullable=True))
    op.add_column("products", sa.Column("allow_backorder", sa.Boolean(), server_default="false"))
    op.add_column("products", sa.Column("seo_title", sa.String(255), nullable=True))
    op.add_column("products", sa.Column("seo_description", sa.String(512), nullable=True))

    # Product unique index store_id + slug
    op.create_index("ix_products_store_slug", "products", ["store_id", "slug"], unique=True)
    op.create_index("ix_products_store_status", "products", ["store_id", "status"])

    # ProductVariant: new fields
    op.add_column("product_variants", sa.Column("store_id", sa.String(36), nullable=True))
    op.add_column("product_variants", sa.Column("compare_at_price", sa.Numeric(12, 2), nullable=True))
    op.add_column("product_variants", sa.Column("track_inventory", sa.Boolean(), server_default="true"))
    op.add_column("product_variants", sa.Column("is_default", sa.Boolean(), server_default="false"))
    op.add_column("product_variants", sa.Column("is_active", sa.Boolean(), server_default="true"))
    op.add_column("product_variants", sa.Column("option_values", sa.JSON(), nullable=True))

    # Backfill store_id in product_variants from product (compatible SQLite y PostgreSQL)
    op.execute("""
        UPDATE product_variants SET store_id = (
            SELECT store_id FROM products WHERE products.id = product_variants.product_id
        )
    """)
    # SQLite: alter_column y FK requieren batch mode
    with op.batch_alter_table("product_variants") as batch_op:
        batch_op.alter_column("store_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_product_variants_store_id",
            "stores", ["store_id"], ["id"],
            ondelete="CASCADE",
        )

    # ProductImage: new fields
    op.add_column("product_images", sa.Column("store_id", sa.String(36), nullable=True))
    op.add_column("product_images", sa.Column("variant_id", sa.String(36), nullable=True))
    op.add_column("product_images", sa.Column("is_cover", sa.Boolean(), server_default="false"))

    # Backfill store_id in product_images from product (compatible SQLite y PostgreSQL)
    op.execute("""
        UPDATE product_images SET store_id = (
            SELECT store_id FROM products WHERE products.id = product_images.product_id
        )
    """)
    # SQLite: alter_column y FK requieren batch mode
    with op.batch_alter_table("product_images") as batch_op:
        batch_op.alter_column("store_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_product_images_store_id",
            "stores", ["store_id"], ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_foreign_key(
            "fk_product_images_variant_id",
            "product_variants", ["variant_id"], ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("product_images") as batch_op:
        batch_op.drop_constraint("fk_product_images_variant_id", type_="foreignkey")
        batch_op.drop_constraint("fk_product_images_store_id", type_="foreignkey")
        batch_op.drop_column("variant_id")
        batch_op.drop_column("store_id")
        batch_op.drop_column("is_cover")

    with op.batch_alter_table("product_variants") as batch_op:
        batch_op.drop_constraint("fk_product_variants_store_id", type_="foreignkey")
        batch_op.drop_column("option_values")
    op.drop_column("product_variants", "is_active")
    op.drop_column("product_variants", "is_default")
    op.drop_column("product_variants", "track_inventory")
    op.drop_column("product_variants", "compare_at_price")
    op.drop_column("product_variants", "store_id")

    op.drop_index("ix_products_store_status", table_name="products")
    op.drop_index("ix_products_store_slug", table_name="products")
    op.drop_column("products", "seo_description")
    op.drop_column("products", "seo_title")
    op.drop_column("products", "allow_backorder")
    op.drop_column("products", "cover_image_url")
    op.drop_column("products", "is_featured")
    op.drop_column("products", "has_variants")
    op.drop_column("products", "product_type")
    op.drop_column("products", "status")
    op.drop_column("products", "short_description")

    op.drop_column("categories", "is_active")
