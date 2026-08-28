# Guangzhou Birthday Game 🎂

為 Sophia (璐洋) 製作的專屬 Q 萌跳跳遊戲！

## 特色
- 🎈 **Q萌女孩/蝦餃主角**
- 🍵 **綠豆湯 & 生日蛋糕加分道具**
- 🚗 **赣E車牌 & 早茶蒸籠跳躍平台**
- ☁️ **气噗噗雲朵 & 電信合約障礙物**

## 如何部署到 GitHub Pages

由於環境中尚未安裝 GitHub CLI 工具，請依照以下步驟手動推送到 GitHub 並開啟 GitHub Pages：

1. 到 [GitHub 建立一個新的 Public 儲存庫](https://github.com/new)，名稱可取為 `guangzhou-jump`。
2. 開啟終端機，進入專案資料夾：
   ```bash
   cd /Users/jim/.gemini/antigravity/scratch/guangzhou_birthday_game
   ```
3. 連結遠端儲存庫並推送：
   ```bash
   git remote add origin https://github.com/<你的帳號>/guangzhou-jump.git
   git branch -M main
   git push -u origin main
   ```
4. 在 GitHub 儲存庫的 **Settings > Pages** 中，將 **Source** 設為 `Deploy from a branch`，Branch 選擇 `main` 的 `/(root)`，然後點擊 **Save**。
5. 等待幾分鐘後，你的遊戲就可以透過 `https://<你的帳號>.github.io/guangzhou-jump/` 分享給 Sophia 囉！🎉
