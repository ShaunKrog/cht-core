const path = require('path');
const chtConfUtils = require('@utils/cht-conf');
const utils = require('@utils');
const loginPage = require('@page-objects/default/login/login.wdio.page');
const commonPage = require('@page-objects/default/common/common.wdio.page');
const userFactory = require('@factories/cht/users/users');
const placeFactory = require('@factories/cht/contacts/place');
const personFactory = require('@factories/cht/contacts/person');
const chtDbUtils = require('@utils/cht-db');

describe('Tasks', () => {
  const places = placeFactory.generateHierarchy();
  const clinic = places.get('clinic');
  const healthCenter = places.get('health_center');

  const contact = personFactory.build({
    name: 'CHW',
    phone: '+12068881234',
    place: healthCenter._id,
    parent: healthCenter
  });
  const chw = userFactory.build({ isOffline: true, place: healthCenter._id, contact: contact._id });
  const owl = personFactory.build({ name: 'Owl', parent: clinic });

  const compileTasks = async (tasksFileName) => {
    await chtConfUtils.initializeConfigDir();
    const tasksFilePath = path.join(__dirname, `config/${tasksFileName}`);
    return await chtConfUtils.compileNoolsConfig({ tasks: tasksFilePath });
  };

  before(async () => {
    await utils.saveDocs([...places.values(), contact, owl]);
    await utils.createUsers([chw]);
    await loginPage.login(chw);
  });

  after(async () => {
    await utils.deleteUsers([chw]);
    await utils.revertDb([/^form:/], true);
    await browser.deleteCookies();
    await browser.refresh();
  });

  afterEach(async () => {
    await utils.revertSettings(true);
  });

  it('Should show error message for bad config', async () => {
    const settings = await compileTasks('tasks-error-config.js');
    await utils.updateSettings(settings, { ignoreReload: 'api', sync: true });
    await commonPage.goToTasks();

    const { errorMessage, url, username, errorStack } = await commonPage.getErrorLog();

    expect(username).to.equal(chw.username);
    expect(url).to.equal('localhost');
    expect(errorMessage).to.equal('Error fetching tasks');
    expect(await (await errorStack.isDisplayed())).to.be.true;
    expect(await (await errorStack.getText())).to
      .include('TypeError: Cannot read properties of undefined (reading \'name\')');

    const feedbackDocs = await chtDbUtils.getFeedbackDocs();
    expect(feedbackDocs.length).to.equal(1);
    expect(feedbackDocs[0].info.message).to.include('Cannot read properties of undefined (reading \'name\')');
    await chtDbUtils.clearFeedbackDocs();
  });
});
