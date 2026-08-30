import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  tableNumber: null,
  publicMenuContext: null,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const exists = state.items.find((item) => item._id === action.payload._id);
      if (exists) {
        exists.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter((item) => item._id !== action.payload);
    },
    clearCart: (state) => {
      state.items = [];
      state.tableNumber = null;
      state.publicMenuContext = null;
    },
    setCartTableNumber: (state, action) => {
      state.tableNumber = action.payload;
    },
    setPublicMenuContext: (state, action) => {
      state.publicMenuContext = action.payload || null;
      state.tableNumber = action.payload?.tableNumber || null;
    },
  },
});

export const { addToCart, removeFromCart, clearCart, setCartTableNumber, setPublicMenuContext } = cartSlice.actions;
export default cartSlice.reducer;
