const { Op } = require('Sequelize');
const schedule = require('node-schedule')
const { Good, Auction, User, sequelize } = require('./models');

module.exports = async () => { //서버 껐다 켰을 때 꺼지는 바람에 낙찰되지 못한 애들 찾아서 낙찰 시켜줌.
  //그리고 꺼진 동안 아직 경매 진행 중인 상품들 찾아서 스케줄
  console.log('checkAuction');
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // 어제 시간
    const targets = await Good.findAll({ //낙찰 안된 애들 낙찰시켜주는 부분
      where: {
        SoldId: null,
        createdAt: { [Op.lte]: yesterday },
      },
    });
    targets.forEach(async (target) => {
      const success = await Auction.findOne({
        where: { GoodId: target.id },
        order: [['bid', 'DESC']],
      });
      await Good.update({ SoldId: success.UserId }, { where: { id: target.id } });
      await User.update({
        money: sequelize.literal(`money - ${success.bid}`),
      }, {
        where: { id: success.UserId },
      });
    });

    const unsold = await Good.findAll({ //낙찰 진행 중인 애들 다시 스케쥴링
      where: {
        SoldId: null,
        createdAt: { [Op.gt]: yesterday },
      },
    });
    unsold.forEach((target) => { //다시 스케줄링
      const end = new Date(unsold.createdAt);
      end.setDate(end.getDate() + 1);
      schedule.scheduleJob(end, async() => {
        const success = await Auction.findOne({
          where: { GoodId: target.id },
          order: [['bid', 'DESC']],
        });
        await Good.update({ SoldId: success.UserId }, { where: { id: target.id } });
        await User.update({
          money: sequelize.literal(`money - ${success.bid}`),
        }, {
          where: { id: success.UserId },
        });
      })
    });
  } catch (error) {
    console.error(error);
  }
};
