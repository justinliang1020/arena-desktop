document.querySelectorAll(".video-preview").forEach((wrapper) => {
  const video = wrapper.querySelector("video");

  wrapper.addEventListener("click", () => {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener("play", () => wrapper.classList.add("is-playing"));
  video.addEventListener("pause", () =>
    wrapper.classList.remove("is-playing"),
  );
});
