"""
Schemas para el sistema de importación desde URL.
"""

from pydantic import BaseModel, HttpUrl


class AnalyzeRequest(BaseModel):
    url: str
    generate_ai_descriptions: bool = False  # Opt-in: user must enable explicitly


class ScrapedProductSchema(BaseModel):
    name: str
    description: str | None = None
    price: float | None = None
    compare_at_price: float | None = None
    image_urls: list[str] = []
    sku: str | None = None
    stock_quantity: int | None = None
    selected: bool = True


class ScrapedDesignSchema(BaseModel):
    logo_url: str | None = None
    favicon_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    background_color: str | None = None
    text_color: str | None = None
    font_heading: str | None = None
    font_body: str | None = None


class ScrapedSectionSchema(BaseModel):
    type: str
    images: list[str] = []
    texts: list[str] = []
    selected: bool = True


class AnalyzeResponse(BaseModel):
    store_name: str | None = None
    products: list[ScrapedProductSchema] = []
    design: ScrapedDesignSchema = ScrapedDesignSchema()
    sections: list[ScrapedSectionSchema] = []
    product_count: int = 0
    image_count: int = 0
    # Currency info (set when store is available)
    source_currency: str | None = None  # Currency detected on the scraped site
    target_currency: str | None = None  # Store's currency (prices converted to this)
    prices_converted: bool = False      # Whether price conversion was applied
    ai_descriptions_generated: int = 0  # Number of AI-generated descriptions


class ImportRequest(BaseModel):
    url: str
    products: list[ScrapedProductSchema] = []
    design: ScrapedDesignSchema | None = None
    sections: list[ScrapedSectionSchema] = []
    import_products: bool = True
    import_design: bool = True
    import_sections: bool = True


class ImportResult(BaseModel):
    products_imported: int = 0
    images_downloaded: int = 0
    design_applied: bool = False
    sections_created: int = 0
    errors: list[str] = []
