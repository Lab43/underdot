const testTree = require('../testing/testTree');



describe('Tree class', () => {
  test('tree matches snapshot', async () => {
    const tree = await testTree();
    expect(tree.tree).toMatchSnapshot();
  })
});
