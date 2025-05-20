import Phaser from 'phaser'

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' })
    this.diceValue = 1
    this.diceColor = 'red'
    this.isRolling = false
    this.colors = ['red', 'blue', 'green', 'yellow', 'purple', 'black']
    this.resultText = null
    this.finalValue = null
  }

  preload() {
    const colors = this.colors
    const numbers = [1, 2, 3, 4, 5, 6]

    colors.forEach((color) => {
      numbers.forEach((num) => {
        this.load.image(`${color}${num}`, `/dice/256px/${color}${num}.png`)
      })
    })
  }

  create() {
    // Tạo xúc xắc với hiệu ứng glow
    this.dice = this.add.sprite(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      `${this.diceColor}${this.diceValue}`,
    )
    this.dice.setScale(0.5)
    this.dice.setOrigin(0.5)

    // Thêm resultText
    this.resultText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 123,
      '',
      {
        fontSize: '55px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      },
    )
    this.resultText.setOrigin(0.5)
    this.resultText.setScale(0)
    this.resultText.setDepth(1)

    // Thêm sự kiện click
    this.input.on('pointerdown', () => {
      if (!this.isRolling && this.finalValue) {
        this.rollDice()
      }
    })
  }

  getRandomColor() {
    return this.colors[Phaser.Math.Between(0, this.colors.length - 1)]
  }

  setFinalValue(value) {
    if (value >= 1 && value <= 6) {
      this.finalValue = value

      // Đợi lâu hơn và kiểm tra đối tượng đã khởi tạo chưa
      this.time.delayedCall(300, () => {
        // Chỉ gọi rollDice nếu các đối tượng cần thiết đã tồn tại
        if (this.dice && this.resultText) {
          this.rollDice()
        } else {
          // Nếu chưa sẵn sàng, thử lại sau một khoảng thời gian
          this.time.delayedCall(300, () => {
            if (this.dice && this.resultText) {
              this.rollDice()
            }
          })
        }
      })
    }
  }

  rollDice() {
    if (this.isRolling || !this.finalValue) return

    this.isRolling = true

    // Thêm kiểm tra null ở đây
    if (this.resultText) {
      this.resultText.setScale(0)
    }

    let rollCount = 0
    const maxRolls = 15
    const rollInterval = 200

    // Thêm hiệu ứng glow khi bắt đầu lăn
    this.tweens.add({
      targets: this.dice,
      alpha: 0.7,
      duration: 100,
      yoyo: true,
      repeat: 1,
    })

    const rollTimer = this.time.addEvent({
      delay: rollInterval,
      callback: () => {
        // Hiệu ứng xoay và scale
        this.tweens.add({
          targets: this.dice,
          angle: Phaser.Math.Between(-30, 30),
          scaleX: 0.4,
          scaleY: 0.4,
          duration: 100,
          yoyo: true,
          ease: 'Sine.easeInOut',
        })

        // Random màu và giá trị xúc xắc trong quá trình lăn
        const randomColor = this.getRandomColor()
        const randomValue = Phaser.Math.Between(1, 6)
        this.dice.setTexture(`${randomColor}${randomValue}`)

        rollCount++

        if (rollCount >= maxRolls) {
          rollTimer.remove()

          // Sử dụng finalValue đã được set
          const finalColor = this.getRandomColor()
          this.diceColor = finalColor
          this.diceValue = this.finalValue

          // Hiệu ứng kết quả
          this.tweens.add({
            targets: this.dice,
            scaleX: 0.5,
            scaleY: 0.5,
            angle: 0,
            duration: 500,
            ease: 'Bounce',
          })

          // Hiệu ứng resultText
          this.resultText.setText(
            `+${this.finalValue.toString()} ${this.finalValue > 1 ? 'Votes' : 'Vote'}`,
          )
          this.resultText.setScale(0)

          this.tweens.add({
            targets: this.resultText,
            scale: 1,
            duration: 1000,
            ease: 'Bounce.easeOut',
            onComplete: () => {
              this.tweens.add({
                targets: this.resultText,
                scale: 0,
                delay: 1000,
                duration: 1000,
                ease: 'Bounce.easeOut',
              })
            },
          })

          // Set texture cuối cùng với giá trị finalValue
          this.dice.setTexture(`${finalColor}${this.finalValue}`)
          this.isRolling = false
          this.finalValue = null
        }
      },
      callbackScope: this,
      repeat: maxRolls - 1,
    })
  }
}

export default MainScene
