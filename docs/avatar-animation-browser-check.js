// Run in the local avatar preview's browser console. Repeat for each family player.
async function checkAvatarAnimation(sequence = 'lay-down', expectedDuration = 2000) {
  const label = sequence === 'turn' ? 'Start turn' : `Play ${sequence}`;
  const button = [...document.querySelectorAll('button')].find(button => button.textContent === label);
  if (button) button.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const avatar = document.querySelector(`[data-avatar-motion="${sequence}"]`);
  const sprite = avatar.querySelector('.player-avatar-sprite');
  const style = getComputedStyle(sprite);
  if (style.clipPath !== 'none') {
    throw new Error(`Hands and cards cannot travel across the portrait: an internal ${style.clipPath} clips the animation.`);
  }
  const animation = sprite.getAnimations()[0];
  const duration = animation.effect.getTiming().duration;
  if (duration !== expectedDuration) {
    throw new Error(`${avatar.dataset.avatarId} ${sequence} must last ${expectedDuration} ms; received ${duration} ms.`);
  }
  animation.pause();
  const positions = new Set();
  for (let frame = 0; frame < 16; frame++) {
    animation.currentTime = frame * duration / 16 + 1;
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
  return {result: 'pass', avatar: avatar.dataset.avatarId, sequence, duration, frames: positions.size, internalClip: style.clipPath, frameBackgrounds: corners};
}
