// Run in the local avatar preview's browser console. Repeat after selecting Jane.
async function checkAvatarAnimation() {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent === 'Play lay-down');
  button.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const avatar = document.querySelector('[data-avatar-motion="lay-down"]');
  const sprite = avatar.querySelector('.player-avatar-sprite');
  const style = getComputedStyle(sprite);
  if (style.clipPath !== 'none') {
    throw new Error(`Lay-down cards cannot travel across the portrait: an internal ${style.clipPath} clips the animation.`);
  }
  const animation = sprite.getAnimations()[0];
  if (animation.effect.getTiming().duration !== 2000) {
    throw new Error('Avatar animations must last two seconds.');
  }
  animation.pause();
  const positions = new Set();
  for (let frame = 0; frame < 16; frame++) {
    animation.currentTime = frame * 125 + 1;
    positions.add(getComputedStyle(sprite).backgroundPosition);
  }
  animation.play();
  if (positions.size !== 16) {
    throw new Error(`Expected sixteen frame positions, received ${positions.size}.`);
  }
  const image = new Image();
  image.src = style.backgroundImage.slice(5, -2);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const corners = Array.from({length: 16}, (_, index) => {
    const x = (index % 4) * image.naturalWidth / 4 + 4;
    const y = Math.floor(index / 4) * image.naturalHeight / 4 + 4;
    return [...context.getImageData(x, y, 1, 1).data];
  });
  // Allow tiny raster variations while rejecting the former cream background.
  if (corners.some(pixel => pixel.slice(0, 3).some(channel => channel < 250) || Math.max(...pixel.slice(0, 3)) - Math.min(...pixel.slice(0, 3)) > 3)) {
    throw new Error(`Animation backgrounds must be white: ${JSON.stringify(corners)}`);
  }
  return {result: 'pass', avatar: avatar.dataset.avatarId, frames: positions.size, internalClip: style.clipPath, frameBackgrounds: corners};
}
