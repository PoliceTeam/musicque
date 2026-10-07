import { expect, it } from 'vitest'
import { tableBoardText } from './tableBoard'
const table = { code: 'FQ8X', visibility: 'public', status: 'waiting', pot: 0, seats: [{userId:'a'}, null, {isBot:true}, {userId:'b'}] }
it('derives waiting, practice and private board copy only from the table', () => {
  expect(tableBoardText(table)).toEqual(['Bàn FQ8X','Đang chờ 2/4','Ván tập',''])
  expect(tableBoardText({...table, visibility:'private', status:'playing',pot:20})).toEqual(['Bàn FQ8X 🔒','Đang chơi','Quỹ 20 PC',''])
  expect(tableBoardText({...table, status:'settling'})[1]).toBe('Đang chơi')
})
it('changes countdown text only at whole-second boundaries and clears expired countdowns', () => {
  const countdown = {...table, startsAt:3000}
  expect(tableBoardText(countdown,0)[1]).toBe('Bắt đầu sau 3')
  expect(tableBoardText(countdown,100)[1]).toBe('Bắt đầu sau 3')
  expect(tableBoardText(countdown,1000)[1]).toBe('Bắt đầu sau 2')
  expect(tableBoardText(countdown,3000)[1]).toBe('Đang chờ 2/4')
  expect(tableBoardText({...table,status:'finished',readyDeadlineAt:30000},6000)).toEqual(['Bàn FQ8X','Kết thúc','Ván tập','Ván mới sau 24s'])
})
