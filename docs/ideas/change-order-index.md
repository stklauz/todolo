Ideas

Currently, checking a todo has no impact on its order_index. Checking the todo will review if the item has a parent or not to determine if it should move to the completed section, and if moved to the completed section, it does just that. However, we're having some issues where, sometimes, when dragging / deleting items with identation, we run into the issue where completed items suddenly resurface due to them persisting their original order_index after being completed.

Eventually, it could be interesting to evaluate the impact of adopting an order_index behavior similar to todoist, where:

- when an item with no parent is checked, it gets appended to the beginning of the completed items.
- once the completed item with no parent is unchecked, it gets appended to the end of the active items
- if an active item has a parent, it stays in active until its parent is completed. A parent is only completed "manually", meaning that even if all its children are completed, the user must check it. Once the parent is checked, we can move it and all its children to the begining of the completed section, preserving its structure.
- if a completed item has a parent and its unchecked, the parent also gets unchecked and the whole group gets appended to the end of the active section.
