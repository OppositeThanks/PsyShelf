from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
FONT = Path(r"C:\Windows\Fonts\georgia.ttf")
SIZE = 1024


def create_icon() -> Image.Image:
    """Create the master transparent PsyShelf application icon."""
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    inset = 76
    draw.rounded_rectangle(
        (inset, inset, SIZE - inset, SIZE - inset),
        radius=245,
        fill="#1f6650",
    )

    font = ImageFont.truetype(str(FONT), 560)
    mark = "Ψ"
    left, top, right, bottom = draw.textbbox((0, 0), mark, font=font)
    width = right - left
    height = bottom - top
    x = (SIZE - width) / 2 - left
    y = (SIZE - height) / 2 - top - 18
    draw.text((x, y), mark, font=font, fill="#fffdf8")
    return image


def main() -> None:
    """Write PNG and multi-resolution Windows ICO icon assets."""
    BUILD.mkdir(parents=True, exist_ok=True)
    image = create_icon()
    image.save(BUILD / "icon.png", optimize=True)
    image.save(
        BUILD / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
