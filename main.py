import imageio.v2 as imageio
import os
import cv2


# 프레임 수 제한 (원하면 더 줄여도 됨)
filenames = list(range(0, 300))
images = []

for filename in filenames:
    path = f"frame_{str(filename).zfill(2)}.png"
    if os.path.exists(path):
        images.append(imageio.imread(path))

# 최적화된 GIF 저장
imageio.mimsave(
    'result.webp',
    images,
    fps=24,
    palettesize=64,        # 색상 수 제한 (작을수록 가벼움)
    subrectangles=True,    # 변화 영역만 저장해서 용량 줄임
    loop=0,                # 무한 반복
    optimize=True          # 내부 최적화 사용
)
