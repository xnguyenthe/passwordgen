function togglePages(){
  const page1 = document.getElementById("page1");
  const page2 = document.getElementById("page2");
  const navbutton = document.getElementById("navbutton");

  if(page1.style.display == "none"){
    page1.style.display = "block";
    page2.style.display = "none";
    navbutton.innerHTML = "Settings";
  }
  else{
    page1.style.display = "none";
    page2.style.display = "block";
    navbutton.innerHTML = "Back";
  }
}

document.getElementById("navbutton").addEventListener("click", togglePages);
