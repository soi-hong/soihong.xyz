const leaves = document.querySelectorAll('.leaf');
let flippedCount = 0;

leaves.forEach((leaf, index) => {
    const initialZIndex = (leaves.length - (index + 1));
    leaf.style.zIndex = initialZIndex;
    
    leaf.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) {
            return;
        }
        
        leaf.classList.toggle('flipped');

        setTimeout(() => {
            const z = leaf.classList.contains('flipped') ? leaves.length - (initialZIndex + 1) : initialZIndex;
            leaf.style.zIndex = z;
        }, 1000);
    });
})