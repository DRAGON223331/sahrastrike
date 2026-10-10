# برومبتات Higgsfield لجرافيك اللعبة

اللعبة بتشتغل كاملة بخامات مولّدة بالكود. لو ولّدت صور بـ Higgsfield، سمّيها بالأسماء دي وحطها في مجلد `assets/` وهتتحمّل تلقائي (من غير تعديل كود):

| اسم الملف | الاستخدام | البرومبت |
|---|---|---|
| `sand.jpg` | أرضية الرمل (مربع، متكرر) | Seamless tileable top-down texture of warm golden desert sand with subtle wind ripples and tiny pebbles, flat even lighting, no shadows, game ground texture |
| `facade.jpg` | واجهات المباني | Seamless tileable texture of weathered sandstone wall in an Arabian old city, beige limestone blocks with a carved geometric arabesque border band, arched window, flat even lighting, front-facing |
| `clay.jpg` | الأسوار الطينية | Seamless tileable texture of sun-baked clay mud-brick wall, terracotta ochre tones, rough plaster patches and cracks, flat even lighting |
| `crate.jpg` | الصناديق | Seamless tileable texture of old wooden planks with dark iron bands, aged cedar wood, front-facing flat lighting |
| `sky.jpg` | السماء (نسبة 2:1 بانوراما) | Wide equirectangular desert sky at golden hour, warm orange and pale blue gradient, thin high clouds, no sun disk, no buildings |
| `keyart.jpg` | خلفية القائمة (16:9) | Cinematic key art for a tactical team shooter in an Arabian desert city at sunset: sandstone alleys, arched doorways, minarets, hanging lanterns, dust, two silhouetted operatives in tactical gear, no text |

للأسلحة: ولّد صورة جانبية للسلاح ثم `generate_3d` (Image to 3D) واحفظ الـ GLB — التحميل التلقائي للـ GLB مش مفعّل في النسخة دي.
