import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  tableNumber: null,
  tableToken: null,
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
      state.tableToken = null;
    },
    setCartTableNumber: (state, action) => {
      state.tableNumber = action.payload;
    },
    setCartTableToken: (state, action) => {
      state.tableToken = action.payload;
    },
  },
});

export const { addToCart, removeFromCart, clearCart, setCartTableNumber, setCartTableToken } = cartSlice.actions;
export default cartSlice.reducer;
