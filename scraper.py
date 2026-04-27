import requests
from bs4 import BeautifulSoup
import os

def download_adilet_law(url, filename):
    print(f"Downloading law from {url}...")
    response = requests.get(url)
    if response.status_code != 200:
        print("Failed to fetch the page.")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    # This is a simplified version, as Adilet has complex structures
    content = soup.find('div', {'id': 'law_text'})
    if not content:
        content = soup.find('div', {'class': 'law-content'})
    
    if content:
        with open(filename + ".txt", "w", encoding="utf-8") as f:
            f.write(content.get_text())
        print(f"Saved to {filename}.txt")
    else:
        print("Could not find law content on the page.")

if __name__ == "__main__":
    # Example usage:
    # download_adilet_law("https://adilet.zan.kz/rus/docs/K990000409_", "GK_RK")
    print("Scraper template ready. Uncomment the example usage to download laws.")
