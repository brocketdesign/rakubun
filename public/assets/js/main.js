document.addEventListener('DOMContentLoaded', function() {
    const burger = document.querySelector(".burger");
    const navLinks = document.querySelector(".nav-links");
    const links = document.querySelectorAll(".nav-links li");
  
    burger.addEventListener("click", () => {
        navLinks.classList.toggle("nav-active");
  
        links.forEach((link, index) => {
            if (link.style.animation) {
                link.style.animation = "";
            } else {
                link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
            }
        });
  
        burger.classList.toggle("toggle");
    });
});