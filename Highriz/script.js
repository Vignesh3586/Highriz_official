function toggleMenu() {
    const nav = document.querySelector('nav ul.head-li');
    const hamburger = document.querySelector('.hamburger');
    nav.classList.toggle('active');
    hamburger.classList.toggle('active');
}

let currentSlide = 0;
const slides = document.querySelector('.slides');
const dots = document.querySelectorAll('.dot');
const slideTexts = document.querySelectorAll('.slide-text');

function showSlide(index) {
    if (index >= slides.children.length) {
        currentSlide = 0;
    } else if (index < 0) {
        currentSlide = slides.children.length - 1;
    } else {
        currentSlide = index;
    }
    slides.style.transform = `translateX(-${currentSlide * 100}%)`;
    updateDots();
    animateText();
}

function nextSlide() {
    showSlide(currentSlide + 1);
}

function prevSlide() {
    showSlide(currentSlide - 1);
}

function goToSlide(index) {
    showSlide(index);
}

function updateDots() {
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function animateText() {
    slideTexts.forEach((text) => {
        text.style.opacity = 0;
    });
    slideTexts[currentSlide].style.opacity = 1;
    slideTexts[currentSlide].style.animation = 'slideTextAnimation 1s ease-in-out forwards';
}

// Auto-play the slider (optional)
setInterval(nextSlide, 3000); // Change slide every 3 seconds

// Initialize the first slide's text
animateText();


document.addEventListener('DOMContentLoaded', function() {
    const contents = document.querySelectorAll('#about > div[class^="about-content"]');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    let currentIndex = 0;

    function updateButtons() {
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === contents.length - 1;
    }

    function showContent(index) {
        contents.forEach((content, i) => {
            content.style.display = i === index ? 'flex' : 'none';
        });
        currentIndex = index;
        updateButtons();
    }

    showContent(0); // Show the first content initially

    nextBtn.addEventListener('click', () => {
        if (currentIndex < contents.length - 1) {
            showContent(currentIndex + 1);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            showContent(currentIndex - 1);
        }
    });
});



document.addEventListener('DOMContentLoaded', function() {
    const clientStats = document.querySelectorAll('.client-stat');

    clientStats.forEach(stat => {
        const numberElement = stat.querySelector('.display-2');
        let targetNumber = parseInt(numberElement.textContent);
        let currentNumber = 0;
        let intervalId; // To store the interval ID

        function animateNumber() {
            if (currentNumber < targetNumber) {
                currentNumber++;
                numberElement.textContent = currentNumber;
            } else {
                clearInterval(intervalId); // Stop the interval when target is reached
                setTimeout(() => { // Reset after a delay
                    currentNumber = 0;
                    numberElement.textContent = currentNumber;
                    intervalId = setInterval(animateNumber, 50); // Restart animation
                }, 2000); // Delay before restart (2 seconds)
            }
        }

        intervalId = setInterval(animateNumber, 50); // Start the animation with an interval of 50ms
    });
});

document.getElementById("contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = document.querySelector("button[type='submit']");
    submitButton.disabled = true; // Prevent multiple submissions
    submitButton.innerText = "Submitting...";

    const formData = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(), // Phone number added
        service: document.getElementById("service").value,
        message: document.getElementById("message").value.trim()
    };

    try {
        const controller = new AbortController();

        const response = await fetch("http://localhost:5000/send-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
        
          const result = await response.json();
          console.log(result); 

        if (!response.ok) throw new Error("Submission failed.");

        alert("✅ Form submitted successfully!");
        document.getElementById("contactForm").reset();
    } catch (error) {
        if (error.name === "AbortError") {
            alert("❌ Submission timeout. Please try again.");
        } else {
            alert("❌ Submission failed. Please check your network and try again.");
        }
        console.error("Error:", error);
    } finally {
        submitButton.disabled = false; // Re-enable button
        submitButton.innerText = "Send Message";
    }
});


