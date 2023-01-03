const thisYear = new Date().getFullYear()
const startTimeOfThisYear = new Date(`${thisYear}-01-01T00:00:00+00:00`).getTime()
const endTimeOfThisYear = new Date(`${thisYear}-12-31T23:59:59+00:00`).getTime()
const progressOfThisYear = (Date.now() - startTimeOfThisYear) / (endTimeOfThisYear - startTimeOfThisYear)
const progressBarOfThisYear = generateProgressBar()

function generateProgressBar() {
    const progressBarCapacity = 30
    const passedProgressBarIndex = parseInt(progressOfThisYear * progressBarCapacity)
    const progressBar =
      '█'.repeat(passedProgressBarIndex) +
      '▁'.repeat(progressBarCapacity - passedProgressBarIndex)
    return `{ ${progressBar} }`
}

const readme = `\
### Hi there 👋
⏳ Year progress ${progressBarOfThisYear} ${(progressOfThisYear * 100).toFixed(2)} %
---
⏰ Updated on ${new Date().toUTCString()}

以下是一些帮助您入门的想法：

- 🔭 0
- 🌱 1
- 👯 0
- 🤔 1
- 💬 0
- 📫 1
- ⚡ 趣闻：biu~
- 😄 代词：哇这是帝企鹅。

[![ Anurag 的 github 统计数据](https://github-readme-stats.vercel.app/api?username=zhaoguohao)](https://github.com/anuraghazra/github-readme-stats)

![](https://raw.githubusercontent.com/phh95/phh95/main/assets/github-contribution-grid-snake.svg)
\
`
console.log(readme)
